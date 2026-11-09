const express = require("express");
const { listJobAttendance, recordAttendance, correctAttendance, myAttendance } = require("../controllers/attendance.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();
router.get("/jobs/:jobId/attendance", protect, authorize(ROLES.RECRUITER, ROLES.PLACEMENT_OFFICER, ROLES.SUPER_ADMIN), listJobAttendance);
router.post("/jobs/:jobId/attendance", protect, authorize(ROLES.RECRUITER), recordAttendance);
router.patch("/attendance/:attendanceId", protect, authorize(ROLES.RECRUITER), correctAttendance);
router.get("/attendance/me", protect, authorize(ROLES.STUDENT), myAttendance);
module.exports = router;
