const express = require("express");
const {
  getVerifiedCompanies,
  getAuthorizedCompanies,
  createCompanyForOfficer,
  authorizeCompany,
  revokeCompanyAuthorization,
  provisionRecruiterForOfficer,
  listRecruitersForOfficer,
  getInstituteDrives,
  getInstituteDriveDetails,
  getRecruitmentMonitor,
  listInstituteStudents,
  getInstituteStudentDetails,
  updateInstituteStudentAcademic,
  recordPlacementOverride,
  getInstituteStudentResume,
  exportInstituteStudentsCsv,
} = require("../controllers/officer.controller");
const { resolveApplicationOffer } = require("../controllers/application.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// All officer routes require authentication + Placement Officer or Super Admin role
router.use(protect, authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"));

// Company registration, authorization & discovery
router.get("/verified-companies", getVerifiedCompanies);
router.get("/authorized-companies", getAuthorizedCompanies);
router.post("/companies", createCompanyForOfficer);
router.post("/companies/:id/authorize", authorizeCompany);
router.delete("/companies/:id/authorize", revokeCompanyAuthorization);

// Recruiter provisioning & management within officer's authorized companies
router.post("/recruiters", provisionRecruiterForOfficer);
router.get("/recruiters", listRecruitersForOfficer);

// Campus recruitment drive monitoring
router.get("/drives", getInstituteDrives);
router.get("/recruitment-monitor", getRecruitmentMonitor);
router.get("/drives/:jobId", getInstituteDriveDetails);
router.put("/applications/:id/offer-resolution", resolveApplicationOffer);

// Campus student directory & academic profile management
router.get("/students/export", exportInstituteStudentsCsv);
router.get("/students", listInstituteStudents);
router.get("/students/:id", getInstituteStudentDetails);
router.put("/students/:id/placement-override", recordPlacementOverride);
router.put("/students/:id", updateInstituteStudentAcademic);
router.get("/students/:id/resume", getInstituteStudentResume);

module.exports = router;
