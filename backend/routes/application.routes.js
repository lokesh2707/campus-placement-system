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
const { createOffer, listOffers, getOffer, updateDraft, issueOffer, myOffers, respond, revokeOffer, updateJoining } = require("../controllers/offer.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Student routes (supports both /jobs/:jobId and direct POST /)
router.post("/jobs/:jobId", protect, authorize("student"), applyToJob);
router.post("/", protect, authorize("student"), applyToJob);
router.get("/me", protect, authorize("student"), getMyApplications);
router.put("/:id/withdraw", protect, authorize("student"), withdrawApplication);
router.get("/offers/me", protect, authorize("student"), myOffers);
router.put("/offers/:offerId/respond", protect, authorize("student"), respond);
router.get("/offers/:offerId", protect, authorize("student","recruiter","placement_officer","admin"), getOffer);

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
router.post("/:applicationId/offer", protect, authorize("recruiter", "admin"), createOffer);
router.put("/offers/:offerId/issue", protect, authorize("recruiter", "admin"), issueOffer);
router.put("/offers/:offerId", protect, authorize("recruiter", "admin"), updateDraft);
router.put("/offers/:offerId/revoke", protect, authorize("recruiter", "admin"), revokeOffer);
router.put("/offers/:offerId/joining", protect, authorize("recruiter", "admin"), updateJoining);
router.get("/offers", protect, authorize("recruiter","placement_officer","admin"), listOffers);

module.exports = router;
