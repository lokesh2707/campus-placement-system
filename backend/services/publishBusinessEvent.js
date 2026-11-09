const { publishDomainEvent } = require("./domainEventPublisher");
const mongoose = require("mongoose");

async function publishBusinessEvent(input) {
  // Unit and contract tests often exercise controllers without a database. Avoid
  // creating a reconnecting buffer; the running application publishes after DB startup.
  if (mongoose.connection.readyState !== 1) return null;
  try { return await publishDomainEvent(input); }
  catch (_) { console.error("Business event could not be queued."); return null; }
}

module.exports = publishBusinessEvent;
