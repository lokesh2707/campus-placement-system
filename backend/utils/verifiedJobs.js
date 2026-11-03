const Company = require("../models/Company");

/**
 * Shared helpers for company-verification enforcement.
 * A company is considered verified only when isVerified === true.
 * Missing/undefined/false are all treated as unverified (never silent-approve).
 */

const isCompanyVerified = (company) =>
  Boolean(company && company.isVerified === true && company.isActive !== false);

/**
 * Returns ObjectIds of verified and active companies.
 */
const getVerifiedCompanyIds = async () => {
  const companies = await Company.find({
    isVerified: true,
    isActive: { $ne: false },
  }).select("_id");
  return companies.map((c) => c._id);
};

/**
 * Mongo match fragment: jobs whose company is verified.
 */
const verifiedCompanyJobFilter = async () => {
  const ids = await getVerifiedCompanyIds();
  return { company: { $in: ids } };
};

module.exports = {
  isCompanyVerified,
  getVerifiedCompanyIds,
  verifiedCompanyJobFilter,
};
