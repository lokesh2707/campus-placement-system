const mongoose = require("mongoose");
const OutboxEvent = require("../models/OutboxEvent");
const { isKnownDomainEvent } = require("../constants/domainEvents");

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|resume(?:text|data|file)?|filedata)/i;
const MAX_PAYLOAD_BYTES = 32 * 1024;

const assertObjectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new Error(`${field} must be a valid identifier`);
};

const assertSafePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Event payload must be an object");
  }
  const inspect = (value, path = "payload") => {
    if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${path}[${index}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`Sensitive event payload field is not allowed: ${path}.${key}`);
      inspect(nested, `${path}.${key}`);
    }
  };
  inspect(payload);
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) {
    throw new Error("Event payload exceeds the 32KB limit");
  }
};

const publishDomainEvent = async (input, { EventModel = OutboxEvent } = {}) => {
  const { eventType, aggregateType, aggregateId, actor = null, institute = null, company = null, payload = {}, idempotencyKey } = input || {};
  if (!isKnownDomainEvent(eventType)) throw new Error("Unsupported domain event type");
  if (!aggregateType || typeof aggregateType !== "string") throw new Error("aggregateType is required");
  if (!idempotencyKey || typeof idempotencyKey !== "string") throw new Error("idempotencyKey is required");
  assertObjectId(aggregateId, "aggregateId");
  if (actor) assertObjectId(actor, "actor");
  if (institute) assertObjectId(institute, "institute");
  if (company) assertObjectId(company, "company");
  assertSafePayload(payload);

  try {
    const event = await EventModel.create({ eventType, aggregateType, aggregateId, actor, institute, company, payload, idempotencyKey });
    return { event, created: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const event = await EventModel.findOne({ idempotencyKey });
    if (!event) throw error;
    return { event, created: false };
  }
};

module.exports = { publishDomainEvent, assertSafePayload, MAX_PAYLOAD_BYTES };
