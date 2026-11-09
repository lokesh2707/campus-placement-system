const OutboxEvent = require("../models/OutboxEvent");
const { OUTBOX_STATUSES } = require("../constants/domainEvents");
const crypto = require("crypto");

// Never persist exception text. It can contain request data, connection strings, or credentials.
const getSafeErrorCategory = (error) => {
  if (error?.name === "ValidationError" || error?.code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
  if (error?.code === "ETIMEDOUT" || error?.name === "TimeoutError") return "TIMEOUT";
  return "HANDLER_ERROR";
};

const safeError = () => "Event processing failed.";

const claimNextEvent = async ({ EventModel = OutboxEvent, now = new Date(), leaseMs = 60_000, claimToken = crypto.randomUUID() } = {}) => {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  return EventModel.findOneAndUpdate(
    {
      $or: [
        { status: OUTBOX_STATUSES.PENDING, availableAt: { $lte: now } },
        { status: OUTBOX_STATUSES.FAILED, availableAt: { $lte: now } },
        { status: OUTBOX_STATUSES.PROCESSING, leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: OUTBOX_STATUSES.PROCESSING,
        claimedAt: now,
        leaseExpiresAt,
        claimToken,
        lastError: "",
        lastErrorCategory: "",
      },
    },
    { new: true, sort: { availableAt: 1, leaseExpiresAt: 1, createdAt: 1 } }
  );
};

const processOneOutboxEvent = async (handler, { EventModel = OutboxEvent, now = new Date(), retryDelayMs = 60_000, leaseMs = 60_000, claimToken } = {}) => {
  if (typeof handler !== "function") throw new Error("An outbox event handler is required");
  const event = await claimNextEvent({ EventModel, now, leaseMs, claimToken });
  if (!event) return { processed: false, reason: "NO_ELIGIBLE_EVENT" };
  const activeClaimToken = event.claimToken;
  try {
    await handler(event);
    const updated = await EventModel.findOneAndUpdate(
      { _id: event._id, status: OUTBOX_STATUSES.PROCESSING, claimToken: activeClaimToken },
      { $set: { status: OUTBOX_STATUSES.PROCESSED, processedAt: now, lastError: "", lastErrorCategory: "", claimedAt: null, leaseExpiresAt: null, claimToken: null } },
      { new: true }
    );
    if (!updated) return { processed: false, event, reason: "STALE_CLAIM" };
    return { processed: true, event: updated };
  } catch (error) {
    const category = getSafeErrorCategory(error);
    const updated = await EventModel.findOneAndUpdate(
      { _id: event._id, status: OUTBOX_STATUSES.PROCESSING, claimToken: activeClaimToken },
      {
        $set: {
          status: OUTBOX_STATUSES.FAILED,
          lastError: safeError(),
          lastErrorCategory: category,
          availableAt: new Date(now.getTime() + retryDelayMs),
          claimedAt: null,
          leaseExpiresAt: null,
          claimToken: null,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );
    return { processed: false, event: updated || event, errorCategory: category, reason: updated ? "HANDLER_ERROR" : "STALE_CLAIM" };
  }
};

module.exports = { claimNextEvent, processOneOutboxEvent, safeError, getSafeErrorCategory };
