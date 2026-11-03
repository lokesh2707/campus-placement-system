/**
 * Simple in-memory rate limiter for authentication endpoints.
 *
 * LIMITATIONS (documented intentionally):
 * - Counters live in process memory and reset when the server restarts.
 * - Counters are NOT shared across multiple Node.js instances / load-balanced hosts.
 * - Suitable for local single-instance deployments; use a shared store (e.g. Redis)
 *   if you later scale horizontally.
 *
 * Configuration via environment (optional):
 * - AUTH_RATE_LIMIT_MAX: max requests per window (default 10). Set to 0 to disable.
 * - AUTH_RATE_LIMIT_WINDOW_MS: window length in ms (default 60000 = 1 minute).
 *
 * Client identity is the direct socket remote address only.
 * Proxy trust / X-Forwarded-For is NOT used, because this deployment is local
 * and does not sit behind a trusted reverse proxy by default.
 */

const hits = new Map();

const cleanupExpired = (windowMs) => {
  const now = Date.now();
  for (const [key, entry] of hits.entries()) {
    if (now - entry.windowStart >= windowMs) {
      hits.delete(key);
    }
  }
};

const createAuthRateLimiter = (options = {}) => {
  const max = Number(
    options.max !== undefined
      ? options.max
      : process.env.AUTH_RATE_LIMIT_MAX !== undefined
        ? process.env.AUTH_RATE_LIMIT_MAX
        : 10
  );
  const windowMs = Number(
    options.windowMs !== undefined
      ? options.windowMs
      : process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000
  );

  return (req, res, next) => {
    if (!max || max <= 0) {
      return next();
    }

    // Periodic lightweight cleanup to avoid unbounded Map growth
    if (hits.size > 5000) {
      cleanupExpired(windowMs);
    }

    const clientKey = req.socket?.remoteAddress || req.ip || "unknown";
    const now = Date.now();
    let entry = hits.get(clientKey);

    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      hits.set(clientKey, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (entry.count > max) {
      const retryAfterSec = Math.ceil(
        (windowMs - (now - entry.windowStart)) / 1000
      );
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      return res.status(429).json({
        success: false,
        message: "Too many authentication attempts. Please try again later.",
      });
    }

    next();
  };
};

/** Test helper: clear in-memory counters (same process only). */
const resetAuthRateLimitStore = () => {
  hits.clear();
};

module.exports = {
  createAuthRateLimiter,
  resetAuthRateLimitStore,
};
