/**
 * Normalize department names so common variants match
 * e.g. "Computer Science & Engineering" === "Computer Science and Engineering"
 */
const normalizeDepartment = (dept) =>
  String(dept || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * True when student department matches an allowed department entry.
 * Uses equality or containment after normalization.
 */
const departmentsMatch = (studentDept, allowedDept) => {
  const student = normalizeDepartment(studentDept);
  const allowed = normalizeDepartment(allowedDept);
  if (!student || !allowed) return false;
  return student === allowed || student.includes(allowed) || allowed.includes(student);
};

const isDepartmentAllowed = (studentDept, allowedDepartments = []) => {
  if (!Array.isArray(allowedDepartments) || allowedDepartments.length === 0) {
    return true;
  }
  return allowedDepartments.some((d) => departmentsMatch(studentDept, d));
};

module.exports = {
  normalizeDepartment,
  departmentsMatch,
  isDepartmentAllowed,
};
