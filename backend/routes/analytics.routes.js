const express = require("express");
const {
  getPlacementOverview,
  getSkillAnalytics,
  exportStudentsCsv,
  exportPlacementsCsv,
  getStudentAnalytics,
} = require("../controllers/analytics.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.get(
  "/overview",
  protect,
  authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"),
  getPlacementOverview
);

router.get(
  "/skills",
  protect,
  authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"),
  getSkillAnalytics
);

router.get(
  "/export/students",
  protect,
  authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"),
  exportStudentsCsv
);

router.get(
  "/export/placements",
  protect,
  authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"),
  exportPlacementsCsv
);

router.get(
  "/student/me",
  protect,
  authorize(ROLES.STUDENT, "student"),
  getStudentAnalytics
);

module.exports = router;
