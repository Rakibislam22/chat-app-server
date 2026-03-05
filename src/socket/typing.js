/**
 * Typing indicator handlers
 *
 * Export: registerTypingHandlers(socket, helpers)
 * Supports both DM (emitToUser to single receiver) and
 * group (socket.to(room) broadcast) conversations.
 */

const TYPING_AUTO_STOP_MS = 5000;
const TYPING_THROTTLE_MS = 500;

const Conversation = require("../models/Conversation");

// Map<"conversationId:userId", { timer, receiverId?, isGroup }>
// Module-level so it persists across all socket connections in this process.
const typingTimers = new Map();

const registerTypingHandlers = (socket, { emitToUser, io }) => {
  // Per-socket throttle map: conversationId → timestamp of last accepted typing:start
  const lastTypingEmit = new Map();

  // ----------------------------------------------------------------
  // typing:start
  // DM    — client emits: { conversationId, receiverId }
  // Group — client emits: { conversationId }  (no receiverId needed)
  // ----------------------------------------------------------------
  socket.on("typing:start", async ({ conversationId, receiverId } = {}) => {
    if (!conversationId) return;

    // Rate limit: ignore bursts faster than TYPING_THROTTLE_MS per conversation
    const now = Date.now();
    const lastEmit = lastTypingEmit.get(conversationId) ?? 0;
    if (now - lastEmit < TYPING_THROTTLE_MS) return;
    lastTypingEmit.set(conversationId, now);

    // Security: ensure the sender is actually a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: socket.userId,
    }).select("type");
    if (!conversation) return;

    const isGroup = conversation.type === "group";
    const key = `${conversationId}:${socket.userId}`;
    const typingPayload = {
      conversationId,
      userId: socket.userId,
      isTyping: true,
    };

    let targetReceiverId = receiverId;
    if (!isGroup && !targetReceiverId) {
      // Find the other participant if not provided by client
      const conv = await Conversation.findById(conversationId).select("participants");
      if (conv) {
        targetReceiverId = conv.participants.find(p => p.toString() !== socket.userId.toString());
      }
    }

    if (isGroup) {
      // Broadcast to all other members in the room (socket.to excludes the sender)
      socket.to(`conv:${conversationId}`).emit("typing:update", typingPayload);
    } else {
      if (!targetReceiverId) return;
      await emitToUser(targetReceiverId, "typing:update", typingPayload);
    }

    // Reset auto-stop timer so continuous keystrokes keep extending it
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key).timer);
    }

    const timer = setTimeout(async () => {
      typingTimers.delete(key);
      const stopPayload = {
        conversationId,
        userId: socket.userId,
        isTyping: false,
      };
      if (isGroup) {
        socket.to(`conv:${conversationId}`).emit("typing:update", stopPayload);
      } else {
        await emitToUser(targetReceiverId, "typing:update", stopPayload);
      }
    }, TYPING_AUTO_STOP_MS);

    // Store timer + metadata for cleanup
    typingTimers.set(key, {
      timer,
      receiverId: isGroup ? null : targetReceiverId,
      isGroup,
    });
  });

  // ----------------------------------------------------------------
  // typing:stop
  // DM    — client emits: { conversationId, receiverId }
  // Group — client emits: { conversationId }
  // ----------------------------------------------------------------
  socket.on("typing:stop", async ({ conversationId, receiverId } = {}) => {
    if (!conversationId) return;

    const key = `${conversationId}:${socket.userId}`;
    const timerData = typingTimers.get(key);

    if (timerData) {
      clearTimeout(timerData.timer);
      typingTimers.delete(key);
    }

    const stopPayload = {
      conversationId,
      userId: socket.userId,
      isTyping: false,
    };

    // Use stored info if available, otherwise find/use provided
    const isGroup = timerData ? timerData.isGroup : !receiverId;
    let targetReceiverId = timerData ? timerData.receiverId : receiverId;

    if (isGroup) {
      socket.to(`conv:${conversationId}`).emit("typing:update", stopPayload);
    } else {
      if (!targetReceiverId) {
        // Fallback search
        const conv = await Conversation.findById(conversationId).select("participants");
        if (conv) {
          targetReceiverId = conv.participants.find(p => p.toString() !== socket.userId.toString());
        }
      }
      if (targetReceiverId)
        await emitToUser(targetReceiverId, "typing:update", stopPayload);
    }
  });

  // ----------------------------------------------------------------
  // cleanup — called on disconnect
  // Cancels all active typing timers for this user and notifies receivers
  // ----------------------------------------------------------------
  const cleanup = async () => {
    const userSuffix = `:${socket.userId}`;
    for (const [key, { timer, receiverId, isGroup }] of typingTimers) {
      if (!key.endsWith(userSuffix)) continue;

      clearTimeout(timer);
      typingTimers.delete(key);

      const conversationId = key.slice(0, -userSuffix.length);
      const stopPayload = {
        conversationId,
        userId: socket.userId,
        isTyping: false,
      };

      if (isGroup) {
        // socket is disconnecting so use io.to instead of socket.to
        if (io)
          io.to(`conv:${conversationId}`).emit("typing:update", stopPayload);
      } else if (receiverId) {
        await emitToUser(receiverId, "typing:update", stopPayload);
      }
    }
  };

  return { cleanup };
};

module.exports = registerTypingHandlers;
