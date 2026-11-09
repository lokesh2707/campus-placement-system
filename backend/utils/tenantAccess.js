const { ROLES, normalizeRole } = require("../constants/roles");

const idOf = (value) => value && String(value._id || value);
const companyAuthorizedForInstitute = (company, instituteId) =>
  Boolean(instituteId && company?.authorizedInstitutes?.some((id) => idOf(id) === String(instituteId)));

const verifyStudentJobAccess = ({ studentProfile, user, job, company }) => {
  const profileInstitute = idOf(studentProfile?.institute);
  const userInstitute = idOf(user?.institute);
  if (!profileInstitute || !userInstitute || profileInstitute !== userInstitute) return { authorized: false, message: "Your institute association could not be verified." };
  if (!company || company.isVerified !== true || company.isActive === false) return { authorized: false, message: "This company is not available for applications." };
  if (!companyAuthorizedForInstitute(company, profileInstitute)) return { authorized: false, message: "This recruitment opportunity is not authorized for your institute." };
  const jobInstitute = idOf(job?.institute);
  if (jobInstitute && jobInstitute !== profileInstitute) return { authorized: false, message: "This recruitment opportunity is restricted to another institute." };
  return { authorized: true, instituteId: profileInstitute };
};

const verifyJobManagementAccess = ({ user, job, company }) => {
  const role = normalizeRole(user?.role);
  if (role === ROLES.SUPER_ADMIN) return { authorized: true };
  if (role === ROLES.RECRUITER) {
    const ownsCompany = idOf(user.company) && idOf(user.company) === idOf(job.company);
    const isPoster = idOf(job.postedBy) === idOf(user._id);
    return ownsCompany || isPoster ? { authorized: true } : { authorized: false, message: "You are not authorized to manage this job listing." };
  }
  if (role !== ROLES.PLACEMENT_OFFICER) return { authorized: false, message: "You are not authorized to manage this job listing." };
  const officerInstitute = idOf(user.institute);
  const jobInstitute = idOf(job.institute);
  if (!officerInstitute || !company || (jobInstitute && jobInstitute !== officerInstitute) || !companyAuthorizedForInstitute(company, officerInstitute)) {
    return { authorized: false, message: "This job is not authorized for your assigned institute." };
  }
  return { authorized: true, instituteId: officerInstitute };
};

module.exports = { idOf, companyAuthorizedForInstitute, verifyStudentJobAccess, verifyJobManagementAccess };
