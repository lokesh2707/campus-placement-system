const express = require("express");
const {
  getRecruiterCompany,
  getRecruiterJobs,
  getRecruiterApplications,
  getRecruiterOverview,
} = require("../controllers/recruiter.controller");
const { createRound, listRecruiterRounds, updateRound, updateRoundStatus, saveFeedback, updateFeedback, submitFeedback } = require("../controllers/interview.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// All recruiter routes require authentication + Recruiter role
router.use(protect, authorize(ROLES.RECRUITER, "recruiter"));

router.get("/company", getRecruiterCompany);
router.get("/jobs", getRecruiterJobs);
router.get("/applications", getRecruiterApplications);
router.get("/overview", getRecruiterOverview);
router.post("/interviews/:applicationId/rounds", createRound);
router.get("/interviews/:applicationId/rounds", listRecruiterRounds);
router.put("/interview-rounds/:roundId", updateRound);
router.patch("/interview-rounds/:roundId/status", updateRoundStatus);
router.post("/interview-rounds/:roundId/feedback", saveFeedback);
router.put("/interview-feedback/:feedbackId", updateFeedback);
router.post("/interview-feedback/:feedbackId/submit", submitFeedback);

module.exports = router;
