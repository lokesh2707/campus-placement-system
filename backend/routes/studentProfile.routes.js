const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getMyProfile,
  upsertMyProfile,
  getProfileCompletionStatus,
  uploadStudentResume,
  deleteStudentResume,
  downloadStudentResume,
  updateMySkills,
  updateMyProjects,
  updateMyCertifications,
  getAllProfiles,
  getProfileById,
} = require("../controllers/studentProfile.controller");
const { studentInterviews } = require("../controllers/interview.controller");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../uploads/resumes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const studentId = req.user?._id || "student";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `resume-${studentId}-${uniqueSuffix}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdfMime = [
      "application/pdf",
      "application/x-pdf",
      "application/acrobat",
      "applications/vnd.pdf",
      "text/pdf",
      "text/x-pdf",
      "application/octet-stream", // Some browsers/clients send octet-stream for pdf
    ].includes(file.mimetype);

    if (ext === ".pdf" && (isPdfMime || !file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF resumes are supported (.pdf)"), false);
    }
  },
});

/**
 * Middleware wrapper to cleanly catch Multer errors (file size, filter)
 * and return standard HTTP 400 responses
 */
const handleResumeUpload = (req, res, next) => {
  upload.single("resume")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds maximum allowed limit of 5MB",
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// --- Student Self-Service Profile Endpoints ---
router
  .route("/profile/me")
  .get(protect, authorize(ROLES.STUDENT, "student"), getMyProfile)
  .put(protect, authorize(ROLES.STUDENT, "student"), upsertMyProfile);

router
  .route("/profile")
  .get(protect, authorize(ROLES.STUDENT, "student"), getMyProfile)
  .put(protect, authorize(ROLES.STUDENT, "student"), upsertMyProfile);

router
  .route("/profile/completion")
  .get(protect, authorize(ROLES.STUDENT, "student"), getProfileCompletionStatus);
router.get("/my-interviews", protect, authorize(ROLES.STUDENT, "student"), studentInterviews);

// Sub-resource updates
router
  .route("/profile/skills")
  .put(protect, authorize(ROLES.STUDENT, "student"), updateMySkills);

router
  .route("/profile/projects")
  .put(protect, authorize(ROLES.STUDENT, "student"), updateMyProjects);

router
  .route("/profile/certifications")
  .put(protect, authorize(ROLES.STUDENT, "student"), updateMyCertifications);

// Resume upload, download, and deletion
router
  .route("/profile/resume")
  .post(protect, authorize(ROLES.STUDENT, "student"), handleResumeUpload, uploadStudentResume)
  .delete(protect, authorize(ROLES.STUDENT, "student"), deleteStudentResume)
  .get(protect, downloadStudentResume);

// Authorized resume download by Student ID / Profile ID
router.route("/:id/resume").get(protect, downloadStudentResume);

// --- Administrative & Placement Officer Scoped Endpoints ---
// Only Placement Officers (scoped) and Super Admins (platform-wide) can access student directory
router
  .route("/")
  .get(
    protect,
    authorize(ROLES.PLACEMENT_OFFICER, "placement_officer", ROLES.SUPER_ADMIN, "admin"),
    getAllProfiles
  );

// Single profile inspection by ID (strictly authorized in controller)
router.route("/:id").get(protect, getProfileById);

module.exports = router;
