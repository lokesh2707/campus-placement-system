const express = require("express");
const {
  applyToJob,
  getMyApplications,
  getJobApplications,
  getApplicationReview,
  evaluateApplication,
  downloadApplicantResume,
  updateApplicationStatus,
  withdrawApplication,
  resolveApplicationOffer,
} = require("../controllers/application.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Student routes (supports both /jobs/:jobId and direct POST /)
router.post("/jobs/:jobId", protect, authorize("student"), applyToJob);
router.post("/", protect, authorize("student"), applyToJob);
router.get("/me", protect, authorize("student"), getMyApplications);
router.put("/:id/withdraw", protect, authorize("student"), withdrawApplication);

// Recruiter / Officer routes
router.get(
  "/jobs/:jobId",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  getJobApplications
);
router.get(
  "/jobs/:jobId/applicants",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  getJobApplications
);
router.get(
  "/:id/review",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  getApplicationReview
);
router.post(
  "/:id/evaluate",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  evaluateApplication
);
router.get("/:id/resume", protect, downloadApplicantResume);
router.put(
  "/:id/status",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  updateApplicationStatus
);
router.put(
  "/:id/offer-resolution",
  protect,
  authorize("recruiter", "placement_officer", "admin"),
  resolveApplicationOffer
);

module.exports = router;
