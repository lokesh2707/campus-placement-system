const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const GeneratedResume = require("../models/GeneratedResume");
const {
  generateProfessionalSummary,
  improveProjectDescription,
} = require("../services/resumeAIService");
const {
  listTemplates,
  isValidTemplateId,
} = require("../services/resumeTemplates");
const {
  generateResumePdf,
  studentDir,
  resolveSafeFilePath,
  ensureDir,
} = require("../services/resumePdfService");
const {
  hashProjectSource,
  getEffectiveProjectDescription,
  validateOptionalHttpsUrl,
} = require("../utils/resumeProfileHelpers");

const cleanStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  const set = new Set();
  arr.forEach((item) => {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0) set.add(trimmed);
    }
  });
  return Array.from(set);
};

const buildSnapshotFromProfile = (user, profile, overrides = {}) => {
  const src = { ...profile, ...overrides };
  const projects = (src.projects || []).map((p) => {
    const plain = typeof p.toObject === "function" ? p.toObject() : { ...p };
    return {
      title: plain.title || "",
      description: getEffectiveProjectDescription(plain),
      technologies: plain.technologies || [],
      githubUrl: plain.githubUrl || "",
      liveUrl: plain.liveUrl || "",
      link: plain.link || "",
    };
  }).filter((p) => p.title);

  return {
    name: overrides.name || user?.name || "",
    email: user?.email || "",
    phone: src.phone || user?.phone || "",
    rollNumber: src.rollNumber || "",
    degree: src.degree || "",
    department: src.department || "",
    batch: src.batch,
    cgpa: src.cgpa,
    instituteName:
      (typeof src.institute === "object" && src.institute?.name) ||
      overrides.instituteName ||
      "",
    professionalSummary: src.professionalSummary || "",
    githubUrl: src.githubUrl || "",
    linkedinUrl: src.linkedinUrl || "",
    portfolioUrl: src.portfolioUrl || "",
    skills: Array.isArray(src.skills) ? src.skills : [],
    projects,
    experience: (src.experience || [])
      .map((e) => (typeof e.toObject === "function" ? e.toObject() : e))
      .filter((e) => e.role && e.company),
    certifications: (src.certifications || [])
      .map((c) => (typeof c.toObject === "function" ? c.toObject() : c))
      .filter((c) => c.title),
  };
};

const applyProfileUpdatesFromBody = async (userId, body, existingProfile) => {
  const updates = {};

  if (body.phone !== undefined) updates.phone = String(body.phone || "").trim();
  if (body.professionalSummary !== undefined) {
    updates.professionalSummary = String(body.professionalSummary || "").trim().slice(0, 1200);
  }
  if (body.degree !== undefined) updates.degree = String(body.degree || "").trim();
  if (body.department !== undefined) updates.department = String(body.department || "").trim();

  for (const [key, hosts] of [
    ["githubUrl", ["github.com"]],
    ["linkedinUrl", ["linkedin.com"]],
    ["portfolioUrl", null],
  ]) {
    if (body[key] === undefined) continue;
    const check = validateOptionalHttpsUrl(body[key], {
      fieldLabel: key,
      allowedHosts: hosts || undefined,
    });
    if (!check.ok) {
      const err = new Error(check.message);
      err.statusCode = 400;
      throw err;
    }
    if (check.value !== null) updates[key] = check.value;
  }

  if (Array.isArray(body.skills)) updates.skills = cleanStringArray(body.skills);
  if (Array.isArray(body.technicalSkills)) {
    updates.technicalSkills = cleanStringArray(body.technicalSkills);
  }

  if (Array.isArray(body.projects)) {
    updates.projects = body.projects
      .map((p) => {
        const title = String(p.title || "").trim();
        const description = String(p.description || "").trim();
        const technologies = cleanStringArray(p.technologies);
        const currentHash = hashProjectSource(title, description, technologies);
        let aiEnhancedDescription = String(p.aiEnhancedDescription || "").trim();
        let aiEnhancedApproved = Boolean(p.aiEnhancedApproved);
        let aiEnhancedSourceHash = String(p.aiEnhancedSourceHash || "").trim();
        if (aiEnhancedApproved && aiEnhancedSourceHash && aiEnhancedSourceHash !== currentHash) {
          aiEnhancedApproved = false;
        }
        return {
          title,
          description,
          technologies,
          link: String(p.link || "").trim(),
          githubUrl: String(p.githubUrl || "").trim(),
          liveUrl: String(p.liveUrl || "").trim(),
          startDate: p.startDate ? new Date(p.startDate) : null,
          endDate: p.endDate ? new Date(p.endDate) : null,
          aiEnhancedDescription,
          aiEnhancedApproved,
          aiEnhancedSourceHash: aiEnhancedApproved
            ? aiEnhancedSourceHash || currentHash
            : aiEnhancedSourceHash,
        };
      })
      .filter((p) => p.title);
  }

  if (Array.isArray(body.experience)) {
    updates.experience = body.experience
      .map((exp) => ({
        role: String(exp.role || "").trim(),
        company: String(exp.company || "").trim(),
        duration: String(exp.duration || "").trim(),
        description: String(exp.description || "").trim(),
        startDate: exp.startDate ? new Date(exp.startDate) : null,
        endDate: exp.endDate ? new Date(exp.endDate) : null,
        isCurrent: Boolean(exp.isCurrent),
      }))
      .filter((e) => e.role && e.company);
  }

  if (Array.isArray(body.certifications)) {
    updates.certifications = body.certifications
      .map((c) => ({
        title: String(c.title || "").trim(),
        issuingOrganization: String(c.issuingOrganization || "").trim(),
        issueDate: c.issueDate ? new Date(c.issueDate) : null,
        expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        credentialUrl: String(c.credentialUrl || "").trim(),
        credentialId: String(c.credentialId || "").trim(),
      }))
      .filter((c) => c.title);
  }

  if (body.name && typeof body.name === "string" && body.name.trim()) {
    await User.findByIdAndUpdate(userId, { $set: { name: body.name.trim() } });
  }
  if (updates.phone !== undefined) {
    await User.findByIdAndUpdate(userId, { $set: { phone: updates.phone } });
  }

  if (!existingProfile) {
    const err = new Error("Complete your student profile before generating a resume.");
    err.statusCode = 400;
    throw err;
  }

  return StudentProfile.findOneAndUpdate(
    { user: userId },
    { $set: updates },
    { returnDocument: "after", runValidators: true }
  ).populate("institute", "name code");
};

/**
 * GET /api/resume-builder/templates
 */
const getTemplates = async (req, res) => {
  res.status(200).json({ success: true, templates: listTemplates() });
};

/**
 * POST /api/resume-builder/ai/summary
 */
const aiSummary = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id }).populate(
      "institute",
      "name"
    );
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found. Complete your profile first.",
      });
    }

    const summary = await generateProfessionalSummary({
      name: req.user.name,
      degree: profile.degree,
      department: profile.department,
      batch: profile.batch,
      cgpa: profile.cgpa,
      skills: profile.skills,
      projects: profile.projects,
      experience: profile.experience,
      certifications: profile.certifications,
    });

    res.status(200).json({
      success: true,
      summary,
      message: "Review the generated summary and save it explicitly if you accept it.",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/resume-builder/ai/project-description
 */
const aiProjectDescription = async (req, res, next) => {
  try {
    const { title, description, technologies, projectIndex } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Project title and description are required.",
      });
    }

    const improved = await improveProjectDescription({
      title,
      description,
      technologies: Array.isArray(technologies) ? technologies : [],
    });

    const sourceHash = hashProjectSource(title, description, technologies || []);

    res.status(200).json({
      success: true,
      improvedDescription: improved,
      sourceHash,
      projectIndex: projectIndex ?? null,
      message: "Review the improved description and approve it before saving.",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/resume-builder/generate
 */
const generateResume = async (req, res, next) => {
  let pendingDoc = null;
  let absoluteFinalPath = null;

  try {
    const { templateId, content, idempotencyKey } = req.body || {};

    if (!isValidTemplateId(templateId)) {
      return res.status(400).json({ success: false, message: "Invalid resume template." });
    }

    const key = String(idempotencyKey || "").trim().slice(0, 120);
    if (key) {
      const existing = await GeneratedResume.findOne({
        student: req.user._id,
        idempotencyKey: key,
        status: "generated",
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Resume already generated for this request.",
          resume: existing,
          idempotent: true,
        });
      }
    }

    let profile = await StudentProfile.findOne({ user: req.user._id }).populate(
      "institute",
      "name code"
    );
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "Complete your student profile before generating a resume.",
      });
    }

    // Persist editor changes into profile (does not touch uploaded resumeUrl)
    if (content && typeof content === "object") {
      profile = await applyProfileUpdatesFromBody(req.user._id, content, profile);
    }

    const user = await User.findById(req.user._id).select("name email phone");
    const snapshot = content?.snapshot
      ? content.snapshot
      : buildSnapshotFromProfile(user, profile, {
          name: content?.name,
          professionalSummary: content?.professionalSummary,
          githubUrl: content?.githubUrl,
          linkedinUrl: content?.linkedinUrl,
          portfolioUrl: content?.portfolioUrl,
          skills: content?.skills,
          projects: content?.projects,
          experience: content?.experience,
          certifications: content?.certifications,
        });

    if (!snapshot.name || !snapshot.email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required to generate a resume.",
      });
    }

    const last = await GeneratedResume.findOne({ student: req.user._id })
      .sort({ version: -1 })
      .select("version");
    const version = (last?.version || 0) + 1;
    const fileName = `resume-v${version}-${Date.now()}.pdf`;
    const dir = studentDir(req.user._id);
    ensureDir(dir);
    absoluteFinalPath = path.join(dir, fileName);
    const relativePath = path
      .join(String(req.user._id), fileName)
      .replace(/\\/g, "/");

    pendingDoc = await GeneratedResume.create({
      student: req.user._id,
      templateId,
      fileName,
      relativePath,
      fileType: "application/pdf",
      version,
      status: "pending",
      contentSnapshot: snapshot,
      idempotencyKey: key || `auto-${crypto.randomBytes(8).toString("hex")}`,
    });

    await generateResumePdf(templateId, snapshot, absoluteFinalPath);

    pendingDoc.status = "generated";
    await pendingDoc.save();

    if (!fs.existsSync(absoluteFinalPath)) {
      pendingDoc.status = "failed";
      await pendingDoc.save();
      return res.status(500).json({
        success: false,
        message: "Resume file was not created. Please try again.",
      });
    }

    res.status(201).json({
      success: true,
      message: "Resume generated successfully.",
      resume: pendingDoc,
    });
  } catch (error) {
    try {
      if (pendingDoc) {
        pendingDoc.status = "failed";
        await pendingDoc.save();
      }
      if (absoluteFinalPath && fs.existsSync(absoluteFinalPath)) {
        // leave failed file for diagnostics only if generated; temp cleaned by pdf service
      }
      if (absoluteFinalPath && fs.existsSync(`${absoluteFinalPath}`)) {
        /* noop */
      }
    } catch {
      /* ignore */
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A resume generation request with this key is already in progress or completed.",
      });
    }
    next(error);
  }
};

/**
 * GET /api/resume-builder/my-resumes
 */
const listMyResumes = async (req, res, next) => {
  try {
    const resumes = await GeneratedResume.find({
      student: req.user._id,
      status: "generated",
    })
      .sort({ version: -1 })
      .select("-contentSnapshot");

    res.status(200).json({ success: true, count: resumes.length, resumes });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resume-builder/:id
 */
const getMyResume = async (req, res, next) => {
  try {
    const resume = await GeneratedResume.findById(req.params.id);
    if (!resume || String(resume.student) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    res.status(200).json({ success: true, resume });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resume-builder/:id/download
 */
const downloadMyResume = async (req, res, next) => {
  try {
    const resume = await GeneratedResume.findById(req.params.id);
    if (
      !resume ||
      String(resume.student) !== String(req.user._id) ||
      resume.status !== "generated"
    ) {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }

    const absolute = resolveSafeFilePath(req.user._id, resume.fileName);
    if (!fs.existsSync(absolute)) {
      return res.status(404).json({
        success: false,
        message: "Resume file is missing from storage.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${resume.fileName.replace(/"/g, "")}"`
    );
    fs.createReadStream(absolute).pipe(res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  aiSummary,
  aiProjectDescription,
  generateResume,
  listMyResumes,
  getMyResume,
  downloadMyResume,
  buildSnapshotFromProfile,
};
