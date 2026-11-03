const express = require("express");
const {
  createCompany,
  getCompanies,
  verifyCompany,
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  publishJob,
  closeJob,
} = require("../controllers/job.controller");
const { protect, authorize, optionalProtect } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// Company management (supports both /companies and /company)
router
  .route("/companies")
  .get(optionalProtect, getCompanies)
  .post(protect, authorize("recruiter", "placement_officer", "admin"), createCompany);

router
  .route("/company")
  .get(optionalProtect, getCompanies)
  .post(protect, authorize("recruiter", "placement_officer", "admin"), createCompany);

router.put(
  "/companies/:id/verify",
  protect,
  authorize(ROLES.SUPER_ADMIN, "admin"),
  verifyCompany
);

// Job listings
router
  .route("/")
  .get(optionalProtect, getJobs)
  .post(protect, authorize("recruiter", "placement_officer", "admin"), createJob);

router
  .route("/:id")
  .get(optionalProtect, getJobById)
  .put(protect, authorize("recruiter", "placement_officer", "admin"), updateJob)
  .delete(protect, authorize("recruiter", "placement_officer", "admin"), deleteJob);

router.put(
  "/:id/publish",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  publishJob
);

router.put(
  "/:id/close",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  closeJob
);

module.exports = router;
