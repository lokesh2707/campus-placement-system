const express = require("express");
const {
  getRecruiterCompany,
  getRecruiterJobs,
  getRecruiterApplications,
  getRecruiterOverview,
} = require("../controllers/recruiter.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// All recruiter routes require authentication + Recruiter role
router.use(protect, authorize(ROLES.RECRUITER, "recruiter"));

router.get("/company", getRecruiterCompany);
router.get("/jobs", getRecruiterJobs);
router.get("/applications", getRecruiterApplications);
router.get("/overview", getRecruiterOverview);

module.exports = router;
