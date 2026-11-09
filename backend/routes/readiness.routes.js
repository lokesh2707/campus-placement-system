const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");
const {
  getMyReadiness,
  updateMySkills,
  getInstituteReadinessSummary,
} = require("../controllers/readiness.controller");

const router = express.Router();
router.get("/me", protect, authorize(ROLES.STUDENT, "student"), getMyReadiness);
router.put("/me/skills", protect, authorize(ROLES.STUDENT, "student"), updateMySkills);
router.get("/institute/summary", protect, authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"), getInstituteReadinessSummary);

module.exports = router;
