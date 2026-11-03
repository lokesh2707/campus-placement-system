/**
 * In-memory per-student AI rate limiting for resume builder.
 * Limits: 10 requests / hour, 40 requests / day per student.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HOUR_LIMIT = 10;
const DAY_LIMIT = 40;

/** @type {Map<string, { hourStart: number, hourCount: number, dayStart: number, dayCount: number }>} */
const buckets = new Map();

const getBucket = (studentId) => {
  const key = String(studentId);
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry) {
    entry = { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
    buckets.set(key, entry);
    return entry;
  }
  if (now - entry.hourStart >= HOUR_MS) {
    entry.hourStart = now;
    entry.hourCount = 0;
  }
  if (now - entry.dayStart >= DAY_MS) {
    entry.dayStart = now;
    entry.dayCount = 0;
  }
  return entry;
};

const aiRateLimit = (req, res, next) => {
  try {
    const studentId = req.user?._id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const entry = getBucket(studentId);
    if (entry.hourCount >= HOUR_LIMIT || entry.dayCount >= DAY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: "AI generation limit reached. Please try again later.",
      });
    }

    entry.hourCount += 1;
    entry.dayCount += 1;
    next();
  } catch (err) {
    next(err);
  }
};

/** Test helper */
const resetAiRateLimits = () => {
  buckets.clear();
};

module.exports = {
  aiRateLimit,
  resetAiRateLimits,
  HOUR_LIMIT,
  DAY_LIMIT,
};
