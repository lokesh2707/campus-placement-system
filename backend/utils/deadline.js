/**
 * Deadline parsing and evaluation utility.
 * Enforces Asia/Kolkata (+05:30) calendar day boundaries for date-only deadlines.
 */

/**
 * Resolves the effective deadline Date object.
 * - Date-only inputs (YYYY-MM-DD string or UTC midnight Date object) expire at
 *   23:59:59.999 in Asia/Kolkata (UTC+5:30), which corresponds to 18:29:59.999Z UTC.
 * - Inputs with explicit non-midnight time components preserve their exact instant.
 *
 * @param {string|Date} deadline
 * @returns {Date|null}
 */
const getEffectiveDeadline = (deadline) => {
  if (!deadline) return null;

  if (typeof deadline === "string") {
    const trimmed = deadline.trim();
    // Check if it's a date-only string: YYYY-MM-DD
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      // End of day in Asia/Kolkata (+05:30)
      return new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;

    // Check if parsed date-string resolved to UTC midnight (e.g. YYYY-MM-DDT00:00:00.000Z)
    if (
      parsed.getUTCHours() === 0 &&
      parsed.getUTCMinutes() === 0 &&
      parsed.getUTCSeconds() === 0 &&
      parsed.getUTCMilliseconds() === 0
    ) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      return new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);
    }
    return parsed;
  }

  if (deadline instanceof Date) {
    if (isNaN(deadline.getTime())) return null;

    // Stored UTC midnight Date object (from Mongoose saving a date-only input)
    if (
      deadline.getUTCHours() === 0 &&
      deadline.getUTCMinutes() === 0 &&
      deadline.getUTCSeconds() === 0 &&
      deadline.getUTCMilliseconds() === 0
    ) {
      const year = deadline.getUTCFullYear();
      const month = String(deadline.getUTCMonth() + 1).padStart(2, "0");
      const day = String(deadline.getUTCDate()).padStart(2, "0");
      return new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);
    }
    return deadline;
  }

  return null;
};

/**
 * Checks whether the application deadline has expired as of `now` (default: new Date()).
 * Returns true if now > effective deadline.
 *
 * @param {string|Date} deadline
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
const isDeadlinePassed = (deadline, now = new Date()) => {
  const effectiveDeadline = getEffectiveDeadline(deadline);
  if (!effectiveDeadline) return false;
  return now.getTime() > effectiveDeadline.getTime();
};

module.exports = {
  getEffectiveDeadline,
  isDeadlinePassed,
};
