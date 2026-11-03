const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadResume,
  getMyResumeAnalysis,
  reviewExtractedSkills,
  confirmStructuredFields,
} = require("../controllers/resume.controller");
const { protect, authorize } = require("../middleware/auth");

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
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "application/x-cfb",
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_EXTENSIONS.includes(ext) ||
      ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents (.pdf, .doc, .docx) are permitted"), false);
    }
  },
});

router.post("/upload", protect, authorize("student"), upload.single("resume"), uploadResume);
router.get("/me", protect, authorize("student"), getMyResumeAnalysis);
router.put("/:id/review", protect, authorize("student"), reviewExtractedSkills);
router.put("/:id/confirm-fields", protect, authorize("student"), confirmStructuredFields);

module.exports = router;
