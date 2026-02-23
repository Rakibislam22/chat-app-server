/**
 * Typing indicator handlers
 *
 * Export: registerTypingHandlers(socket, helpers)
 */

const registerTypingHandlers = (socket, { emitToUser }) => {
  // ----------------------------------------------------------------
  // typing:start
  // Client emits: { conversationId, receiverId }
  // ----------------------------------------------------------------
  socket.on("typing:start", async ({ conversationId, receiverId } = {}) => {
    if (!conversationId || !receiverId) return;

    await emitToUser(receiverId, "typing:update", {
      conversationId,
      userId: socket.userId,
      isTyping: true,
    });
  });

  // ----------------------------------------------------------------
  // typing:stop
  // Client emits: { conversationId, receiverId }
  // ----------------------------------------------------------------
  socket.on("typing:stop", async ({ conversationId, receiverId } = {}) => {
    if (!conversationId || !receiverId) return;

    await emitToUser(receiverId, "typing:update", {
      conversationId,
      userId: socket.userId,
      isTyping: false,
    });
  });
};

module.exports = registerTypingHandlers;
