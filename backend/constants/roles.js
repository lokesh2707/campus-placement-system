/**
 * Standardized Role Architecture (Phase 2)
 * Exactly four roles across the entire platform:
 * 1. SUPER_ADMIN
 * 2. PLACEMENT_OFFICER
 * 3. RECRUITER
 * 4. STUDENT
 */

const ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  PLACEMENT_OFFICER: "PLACEMENT_OFFICER",
  RECRUITER: "RECRUITER",
  STUDENT: "STUDENT",
});

const LEGACY_ROLE_MAP = Object.freeze({
  admin: ROLES.SUPER_ADMIN,
  placement_officer: ROLES.PLACEMENT_OFFICER,
  recruiter: ROLES.RECRUITER,
  student: ROLES.STUDENT,
  // Standardized roles map to themselves
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  PLACEMENT_OFFICER: ROLES.PLACEMENT_OFFICER,
  RECRUITER: ROLES.RECRUITER,
  STUDENT: ROLES.STUDENT,
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

/**
 * Normalizes any role input (legacy lowercase or standardized uppercase)
 * into one of the four standardized roles.
 *
 * @param {string} role
 * @returns {string} Standardized role string or original if unmapped
 */
const normalizeRole = (role) => {
  if (!role || typeof role !== "string") return role;
  return LEGACY_ROLE_MAP[role] || LEGACY_ROLE_MAP[role.toLowerCase()] || role;
};

module.exports = {
  ROLES,
  LEGACY_ROLE_MAP,
  ALL_ROLES,
  normalizeRole,
};
