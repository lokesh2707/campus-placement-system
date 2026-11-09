const mongoose = require("mongoose");
const { DOMAIN_EVENTS, OUTBOX_STATUSES } = require("../constants/domainEvents");

const OutboxEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, enum: Object.values(DOMAIN_EVENTS), immutable: true },
    aggregateType: { type: String, required: true, trim: true, maxlength: 80, immutable: true },
    aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    institute: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", default: null, immutable: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, immutable: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    // Deliberately limited to event metadata; resumes, credentials, and tokens are rejected by the publisher.
    payload: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    status: { type: String, enum: Object.values(OUTBOX_STATUSES), default: OUTBOX_STATUSES.PENDING, index: true },
    attempts: { type: Number, default: 0, min: 0 },
    availableAt: { type: Date, default: Date.now, index: true },
    // Lease fields make interrupted PROCESSING work safely reclaimable.
    claimedAt: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null, index: true },
    claimToken: { type: String, default: null, maxlength: 100 },
    processedAt: { type: Date, default: null },
    lastError: { type: String, default: "", maxlength: 500 },
    lastErrorCategory: { type: String, default: "", maxlength: 80 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
  },
  { timestamps: true, minimize: false }
);

OutboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
OutboxEventSchema.index({ status: 1, leaseExpiresAt: 1, createdAt: 1 });
OutboxEventSchema.index({ aggregateType: 1, aggregateId: 1, createdAt: -1 });
OutboxEventSchema.index({ idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model("OutboxEvent", OutboxEventSchema);
