/**
 * Feed socket handler — manages per-post rooms for real-time reaction updates.
 *
 * Clients join `feed:post:<id>` when viewing a post detail and leave on close.
 * The react REST controller broadcasts `feed:post:reacted` to this room.
 */
module.exports = function registerFeedHandlers(socket) {
  socket.on("feed:post:join", (postId) => {
    if (typeof postId === "string" && postId.length > 0) {
      socket.join(`feed:post:${postId}`);
    }
  });

  socket.on("feed:post:leave", (postId) => {
    if (typeof postId === "string" && postId.length > 0) {
      socket.leave(`feed:post:${postId}`);
    }
  });
};
