const mongoose = require("mongoose");
const { DOMAIN_EVENTS } = require("../constants/domainEvents");

const NotificationSchema = new mongoose.Schema({
  recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  sourceEventId: { type: mongoose.Schema.Types.ObjectId, ref: "OutboxEvent", required: true, immutable: true },
  type: { type: String, required: true, enum: Object.values(DOMAIN_EVENTS), immutable: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 300 },
  entityType: { type: String, required: true, enum: ["Application", "InterviewRound", "Offer"] },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  actionPath: { type: String, required: true, maxlength: 300 },
  readAt: { type: Date, default: null },
}, { timestamps: true });

NotificationSchema.index({ recipientUser: 1, sourceEventId: 1 }, { unique: true });
NotificationSchema.index({ recipientUser: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ recipientUser: 1, readAt: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
