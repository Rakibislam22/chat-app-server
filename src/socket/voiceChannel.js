const Module = require("../models/Module");

const registerVoiceChannelHandlers = (socket, { io }) => {
  socket.on("voice_channel:join", async ({ moduleId, workspaceId }) => {
    try {
      const voiceModule = await Module.findById(moduleId);
      if (!voiceModule || voiceModule.type !== "voice") return;

      // Deduplicate — remove existing entry for this user before re-adding
      voiceModule.activeParticipants = voiceModule.activeParticipants.filter(
        (p) => p.userId.toString() !== socket.userId.toString()
      );
      voiceModule.activeParticipants.push({ userId: socket.userId, joinedAt: new Date() });
      await voiceModule.save();

      socket.join(`voice-channel-${moduleId}`);

      io.to(`voice-channel-${moduleId}`).emit("voice_channel:participants", {
        moduleId,
        participants: voiceModule.activeParticipants,
      });
    } catch (error) {
      console.error("voice_channel:join error:", error);
    }
  });

  socket.on("voice_channel:leave", async ({ moduleId }) => {
    try {
      const voiceModule = await Module.findById(moduleId);
      if (!voiceModule) return;

      voiceModule.activeParticipants = voiceModule.activeParticipants.filter(
        (p) => p.userId.toString() !== socket.userId.toString()
      );
      await voiceModule.save();

      socket.leave(`voice-channel-${moduleId}`);

      io.to(`voice-channel-${moduleId}`).emit("voice_channel:participants", {
        moduleId,
        participants: voiceModule.activeParticipants,
      });
    } catch (error) {
      console.error("voice_channel:leave error:", error);
    }
  });
};

module.exports = registerVoiceChannelHandlers;
