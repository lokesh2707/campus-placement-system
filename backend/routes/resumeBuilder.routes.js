const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../constants/roles");
const { aiRateLimit } = require("../middleware/aiRateLimit");
const {
  getTemplates,
  aiSummary,
  aiProjectDescription,
  aiExperienceDescription,
  generateResume,
  listMyResumes,
  getMyResume,
  downloadMyResume,
} = require("../controllers/resumeBuilder.controller");

const router = express.Router();

router.use(protect, authorize(ROLES.STUDENT, "student"));

router.get("/templates", getTemplates);
router.post("/ai/summary", aiRateLimit, aiSummary);
router.post("/ai/project-description", aiRateLimit, aiProjectDescription);
router.post("/ai/experience-description", aiRateLimit, aiExperienceDescription);
router.post("/generate", generateResume);
router.get("/my-resumes", listMyResumes);
router.get("/:id/download", downloadMyResume);
router.get("/:id", getMyResume);

module.exports = router;
