const crypto = require("crypto");

const hashProjectSource = (title, description, technologies) => {
  const tech = Array.isArray(technologies)
    ? technologies.map((t) => String(t).trim().toLowerCase()).filter(Boolean).sort().join("|")
    : "";
  const raw = `${String(title || "").trim()}||${String(description || "").trim()}||${tech}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
};

const isEnhancedOutdated = (project) => {
  if (!project?.aiEnhancedApproved || !project?.aiEnhancedDescription) return true;
  if (!project.aiEnhancedSourceHash) return true;
  const current = hashProjectSource(project.title, project.description, project.technologies);
  return current !== project.aiEnhancedSourceHash;
};

const getEffectiveProjectDescription = (project) => {
  if (!project) return "";
  if (
    project.aiEnhancedApproved &&
    project.aiEnhancedDescription &&
    !isEnhancedOutdated(project)
  ) {
    return String(project.aiEnhancedDescription).trim();
  }
  return String(project.description || "").trim();
};

/**
 * Validate optional HTTPS professional links.
 * Empty / whitespace => { ok: true, value: null } meaning "do not overwrite".
 * Invalid => { ok: false, message }
 * Valid => { ok: true, value: normalizedUrl }
 */
const validateOptionalHttpsUrl = (raw, { fieldLabel, allowedHosts } = {}) => {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || String(raw).trim() === "") {
    return { ok: true, value: null };
  }

  let parsed;
  try {
    parsed = new URL(String(raw).trim());
  } catch {
    return { ok: false, message: `${fieldLabel || "URL"} must be a valid URL` };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, message: `${fieldLabel || "URL"} must use HTTPS` };
  }

  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const allowed = allowedHosts.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );
    if (!allowed) {
      return {
        ok: false,
        message: `${fieldLabel || "URL"} must be a ${allowedHosts.join(" or ")} link`,
      };
    }
  }

  return { ok: true, value: parsed.toString() };
};

module.exports = {
  hashProjectSource,
  isEnhancedOutdated,
  getEffectiveProjectDescription,
  validateOptionalHttpsUrl,
};
