const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["dm", "group", "workspace"],
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: function () {
        return this.type === "dm" || this.type === "group";
      },
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: function () {
        return this.type === "workspace";
      },
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: Date,
        leftAt: Date,
        status: {
          type: String,
          enum: ["joined", "declined", "missed", "no_answer"],
          default: "no_answer",
        },
      },
    ],
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: Date,
    duration: Number, // seconds
    livekitRoomName: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "ended", "missed"],
      default: "active",
    },
  },
  { timestamps: true }
);

callLogSchema.index({ conversationId: 1, createdAt: -1 });
callLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("CallLog", callLogSchema);
