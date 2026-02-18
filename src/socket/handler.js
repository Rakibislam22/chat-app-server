/**
 * Socket.io event handlers and configuration
 */

const jwt = require("jsonwebtoken");
const { redisClient, getIsRedisConnected } = require("../config/redis");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

// In-memory userId -> socketId map (fallback when Redis is unavailable)
const onlineUsers = new Map();

const socketHandler = (io) => {
  // --- Socket Authentication Middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`✅ User connected: ${socket.id} (userId: ${userId})`);

    // ── Register presence ──────────────────────────────────────
    onlineUsers.set(userId, socket.id);

    if (getIsRedisConnected()) {
      try {
        await redisClient.set(`online:${userId}`, socket.id, { EX: 86400 });
      } catch (err) {
        console.error("Redis presence set error:", err);
      }
    }

    // Notify others this user is online
    socket.broadcast.emit("user:status", { userId, status: "online" });

    // ── Join personal room for easy targeting ──────────────────
    socket.join(userId);

    // ── message:send ───────────────────────────────────────────
    // payload: { conversationId, receiverId, text }
    socket.on("message:send", async (data, callback) => {
      try {
        const { conversationId, receiverId, text } = data;

        if (!conversationId || !receiverId || !text?.trim()) {
          return callback?.({ error: "Missing fields" });
        }

        // 1. Save to DB
        const message = await Message.create({
          conversationId,
          sender: userId,
          text: text.trim(),
          status: "sent",
        });

        // 2. Update conversation's lastMessage
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text: text.trim(),
            sender: userId,
            timestamp: message.createdAt,
          },
        });

        // 3. Populate sender info for the client
        await message.populate("sender", "name avatar");

        const messageData = message.toObject();

        // 4. Send to receiver (via their personal room)
        io.to(receiverId).emit("message:receive", messageData);

        // 5. Ack back to sender with the saved message
        callback?.({ success: true, message: messageData });
      } catch (err) {
        console.error("message:send error:", err);
        callback?.({ error: "Failed to send message" });
      }
    });

    // ── message:read ───────────────────────────────────────────
    // payload: { conversationId, senderId }
    socket.on("message:read", async (data) => {
      try {
        const { conversationId, senderId } = data;

        await Message.updateMany(
          { conversationId, sender: senderId, status: { $ne: "read" } },
          { status: "read" },
        );

        // Notify the original sender their messages were read
        io.to(senderId).emit("message:read:ack", {
          conversationId,
          readBy: userId,
        });
      } catch (err) {
        console.error("message:read error:", err);
      }
    });

    // ── user:typing ────────────────────────────────────────────
    // payload: { conversationId, receiverId }
    socket.on("user:typing", (data) => {
      const { receiverId, conversationId } = data;
      io.to(receiverId).emit("user:typing", {
        conversationId,
        userId,
      });
    });

    socket.on("user:stop-typing", (data) => {
      const { receiverId, conversationId } = data;
      io.to(receiverId).emit("user:stop-typing", {
        conversationId,
        userId,
      });
    });

    // ── Get online users ───────────────────────────────────────
    socket.on("users:online", (userIds, callback) => {
      const result = {};
      for (const id of userIds) {
        result[id] = onlineUsers.has(id);
      }
      callback?.(result);
    });

    // ── Handle disconnection ───────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${socket.id} (userId: ${userId})`);

      onlineUsers.delete(userId);

      if (getIsRedisConnected()) {
        try {
          await redisClient.del(`online:${userId}`);
        } catch (err) {
          console.error("Redis presence delete error:", err);
        }
      }

      // Notify others this user went offline
      socket.broadcast.emit("user:status", { userId, status: "offline" });
    });
  });
};

module.exports = socketHandler;
