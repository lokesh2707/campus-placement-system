const express = require("express");
const {
  listUsers,
  updateUserStatus,
  updateUserRole,
  getAdminOverview,
  createPrivilegedUser,
  reissueOfficerCredentials,
  listInstitutes,
  getInstituteById,
  createInstitute,
  updateInstitute,
  updateInstituteStatus,
  deleteInstitute,
  listCompaniesAdmin,
  createCompanyAdmin,
  getCompanyByIdAdmin,
  updateCompanyAdmin,
  verifyCompanyAdmin,
  updateCompanyStatusAdmin,
  provisionRecruiterAdmin,
  authorizeCompanyAdmin,
  revokeCompanyAuthorizationAdmin,
} = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// All admin routes require authentication + Super Admin role
router.use(protect, authorize(ROLES.SUPER_ADMIN, "admin"));

// Dashboard & User management
router.get("/overview", getAdminOverview);
router.get("/users", listUsers);
router.post("/users/create", createPrivilegedUser);
router.post("/users/:id/reissue-credentials", reissueOfficerCredentials);
router.put("/users/:id/status", updateUserStatus);
router.put("/users/:id/role", updateUserRole);

// Institute management
router.get("/institutes", listInstitutes);
router.get("/institutes/:id", getInstituteById);
router.post("/institutes", createInstitute);
router.put("/institutes/:id", updateInstitute);
router.put("/institutes/:id/status", updateInstituteStatus);
router.delete("/institutes/:id", deleteInstitute);

// Company management (Super Admin platform-wide control)
router.get("/companies", listCompaniesAdmin);
router.post("/companies", createCompanyAdmin);
router.get("/companies/:id", getCompanyByIdAdmin);
router.put("/companies/:id", updateCompanyAdmin);
router.put("/companies/:id/verify", verifyCompanyAdmin);
router.put("/companies/:id/status", updateCompanyStatusAdmin);
router.post("/companies/:id/authorize", authorizeCompanyAdmin);
router.post("/companies/:id/institutes/:instituteId", authorizeCompanyAdmin);
router.delete("/companies/:id/authorize", revokeCompanyAuthorizationAdmin);
router.delete("/companies/:id/institutes/:instituteId", revokeCompanyAuthorizationAdmin);

// Recruiter Provisioning (Super Admin platform-wide creation)
router.post("/recruiters", provisionRecruiterAdmin);

module.exports = router;
