const { processOneOutboxEvent } = require("./outboxProcessor");
const { handleNotificationEvent } = require("./notificationEventHandler");

function createNotificationWorker({ process = processOneOutboxEvent, handler = handleNotificationEvent, intervalMs = 1500, maxBatch = 10, logger = console } = {}) {
  let timer = null; let stopping = false; let running = null;
  const poll = async () => {
    if (stopping || running) return running;
    running = (async () => {
      for (let i = 0; i < maxBatch && !stopping; i += 1) {
        try { const result = await process(handler); if (!result.processed && result.reason === "NO_ELIGIBLE_EVENT") break; }
        catch (_) { logger.error("Notification outbox worker iteration failed."); break; }
      }
    })();
    try { await running; } finally { running = null; }
  };
  return {
    start() { if (timer || stopping) return; timer = setInterval(() => { void poll(); }, intervalMs); timer.unref?.(); void poll(); },
    async stop() { stopping = true; if (timer) clearInterval(timer); timer = null; if (running) await running; },
    poll,
  };
}

let singleton;
function startNotificationWorker(options) { if (!singleton) singleton = createNotificationWorker(options); singleton.start(); return singleton; }
module.exports = { createNotificationWorker, startNotificationWorker };
