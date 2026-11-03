const express = require("express");
const {
  getMyRecommendations,
  getJobSkillGap,
} = require("../controllers/recommendation.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/me", protect, authorize("student"), getMyRecommendations);
router.get("/", protect, authorize("student"), getMyRecommendations);
router.get("/jobs/:jobId/gap", protect, authorize("student"), getJobSkillGap);

module.exports = router;
