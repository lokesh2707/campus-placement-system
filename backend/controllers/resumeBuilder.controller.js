const fs = require("fs");
const crypto = require("crypto");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const GeneratedResume = require("../models/GeneratedResume");
const {
  generateProfessionalSummary,
  improveProjectDescription,
  improveExperienceDescription,
} = require("../services/resumeAIService");
const {
  listTemplates,
  isValidTemplateId,
} = require("../services/resumeTemplates");
const {
  generateResumePdf,
  resolveSafeFilePath,
} = require("../services/resumePdfService");

/** Public resume JSON without binary PDF payload */
const toResumeResponse = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj.fileData;
  return obj;
};
const {
  hashProjectSource,
  hashExperienceSource,
  getEffectiveProjectDescription,
  getEffectiveExperienceDescription,
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
  const plainProfile =
    profile && typeof profile.toObject === "function" ? profile.toObject() : { ...profile };
  const src = { ...plainProfile, ...overrides };
  const ah = src.academicHistory || {};
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

  const instituteName =
    (typeof src.institute === "object" && src.institute?.name) ||
    overrides.instituteName ||
    "";

  return {
    name: overrides.name || user?.name || "",
    email: user?.email || "",
    phone: src.phone || user?.phone || "",
    rollNumber: src.rollNumber || "",
    degree: src.degree || "",
    department: src.department || "",
    batch: src.batch,
    cgpa: src.cgpa,
    instituteName,
    collegeStartYear: ah.collegeStartYear ?? "",
    intermediateName: ah.intermediateName || "",
    intermediateDuration: ah.intermediateDuration || "",
    schoolName: ah.schoolName || "",
    schoolDuration: ah.schoolDuration || "",
    tenthPercentage: ah.tenthPercentage ?? "",
    twelfthPercentage: ah.twelfthPercentage ?? "",
    // Summary lives on the resume snapshot only (from builder/AI), not StudentProfile
    professionalSummary: String(overrides.professionalSummary || "").trim(),
    githubUrl: src.githubUrl || "",
    linkedinUrl: src.linkedinUrl || "",
    portfolioUrl: src.portfolioUrl || "",
    skills: Array.isArray(src.skills) ? src.skills : [],
    projects,
    experience: (src.experience || [])
      .map((e) => {
        const plain = typeof e.toObject === "function" ? e.toObject() : { ...e };
        return {
          ...plain,
          description: getEffectiveExperienceDescription(plain),
        };
      })
      .filter((e) => e.role && e.company),
    certifications: (src.certifications || [])
      .map((c) => (typeof c.toObject === "function" ? c.toObject() : c))
      .filter((c) => c.title),
  };
};

const applyProfileUpdatesFromBody = async (userId, body, existingProfile) => {
  const updates = {};

  if (body.phone !== undefined) updates.phone = String(body.phone || "").trim();
  // professionalSummary is resume-only (auto-generated into PDF snapshot) — not stored on StudentProfile
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
      .map((exp) => {
        const role = String(exp.role || "").trim();
        const company = String(exp.company || "").trim();
        const description = String(exp.description || "").trim();
        const currentHash = hashExperienceSource(role, company, description);
        let aiEnhancedDescription = String(exp.aiEnhancedDescription || "").trim();
        let aiEnhancedApproved = Boolean(exp.aiEnhancedApproved);
        let aiEnhancedSourceHash = String(exp.aiEnhancedSourceHash || "").trim();
        if (aiEnhancedApproved && aiEnhancedSourceHash && aiEnhancedSourceHash !== currentHash) {
          aiEnhancedApproved = false;
        }
        return {
          role,
          company,
          duration: String(exp.duration || "").trim(),
          description,
          aiEnhancedDescription,
          aiEnhancedApproved,
          aiEnhancedSourceHash: aiEnhancedApproved
            ? aiEnhancedSourceHash || currentHash
            : aiEnhancedSourceHash,
          startDate: exp.startDate ? new Date(exp.startDate) : null,
          endDate: exp.endDate ? new Date(exp.endDate) : null,
          isCurrent: Boolean(exp.isCurrent),
        };
      })
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

    const body = req.body || {};
    const effectiveProfile = profile || {};

    const summary = await generateProfessionalSummary({
      name: body.name || req.user.name,
      degree: body.degree || effectiveProfile.degree || "B.Tech",
      department: body.department || effectiveProfile.department || "Computer Science and Engineering",
      batch: body.batch || effectiveProfile.batch,
      cgpa: body.cgpa ?? effectiveProfile.cgpa,
      skills: Array.isArray(body.skills) && body.skills.length > 0 ? body.skills : effectiveProfile.skills || [],
      projects: Array.isArray(body.projects) && body.projects.length > 0 ? body.projects : effectiveProfile.projects || [],
      experience: Array.isArray(body.experience) && body.experience.length > 0 ? body.experience : effectiveProfile.experience || [],
      certifications: Array.isArray(body.certifications) && body.certifications.length > 0 ? body.certifications : effectiveProfile.certifications || [],
      currentSummary: body.currentSummary || body.professionalSummary || "",
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
 * POST /api/resume-builder/ai/experience-description
 */
const aiExperienceDescription = async (req, res, next) => {
  try {
    const { role, company, duration, description, experienceIndex } = req.body || {};
    if (!role || !description) {
      return res.status(400).json({
        success: false,
        message: "Role and description are required.",
      });
    }

    const improved = await improveExperienceDescription({
      role,
      company,
      duration,
      description,
    });

    const sourceHash = hashExperienceSource(role, company || "", description);

    res.status(200).json({
      success: true,
      improvedDescription: improved,
      sourceHash,
      experienceIndex: experienceIndex ?? null,
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

  try {
    const { templateId, content, idempotencyKey, replaceResumeId } = req.body || {};

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
          resume: toResumeResponse(existing),
          idempotent: true,
        });
      }
    }

    let resumeToReplace = null;
    if (replaceResumeId) {
      resumeToReplace = await GeneratedResume.findOne({
        _id: replaceResumeId,
        student: req.user._id,
      });
      // If specific resume not found, try finding any generated resume for this student to replace;
      // if none found, seamlessly fall back to generating a fresh new resume.
      if (!resumeToReplace) {
        resumeToReplace = await GeneratedResume.findOne({
          student: req.user._id,
          status: "generated",
        }).sort({ updatedAt: -1 });
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
    const version = resumeToReplace
      ? resumeToReplace.version
      : (last?.version || 0) + 1;

    const sanitizeResumeFileName = (raw) => {
      let base = String(raw || "")
        .trim()
        .replace(/\.pdf$/i, "");
      base = base
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      if (!base) base = `resume-v${version}`;
      return `${base}.pdf`;
    };

    const fileName = sanitizeResumeFileName(req.body?.fileName);

    // Drop any legacy on-disk copy when replacing
    if (resumeToReplace?.fileName) {
      try {
        const oldPath = resolveSafeFilePath(req.user._id, resumeToReplace.fileName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
        /* ignore missing/invalid old file */
      }
    }

    if (resumeToReplace) {
      resumeToReplace.templateId = templateId;
      resumeToReplace.fileName = fileName;
      resumeToReplace.relativePath = "";
      resumeToReplace.contentSnapshot = snapshot;
      resumeToReplace.status = "pending";
      if (key) resumeToReplace.idempotencyKey = key;
      await resumeToReplace.save();
      pendingDoc = resumeToReplace;
    } else {
      pendingDoc = await GeneratedResume.create({
        student: req.user._id,
        templateId,
        fileName,
        relativePath: "",
        fileType: "application/pdf",
        version,
        status: "pending",
        contentSnapshot: snapshot,
        idempotencyKey: key || `auto-${crypto.randomBytes(8).toString("hex")}`,
      });
    }

    const pdfBuffer = await generateResumePdf(templateId, snapshot);

    pendingDoc.fileData = pdfBuffer;
    pendingDoc.fileSize = pdfBuffer.length;
    pendingDoc.relativePath = "";
    pendingDoc.status = "generated";
    await pendingDoc.save();

    res.status(resumeToReplace ? 200 : 201).json({
      success: true,
      message: resumeToReplace
        ? "Resume updated successfully."
        : "Resume generated successfully.",
      resume: toResumeResponse(pendingDoc),
      replaced: Boolean(resumeToReplace),
    });
  } catch (error) {
    try {
      if (pendingDoc) {
        pendingDoc.status = "failed";
        pendingDoc.fileData = undefined;
        pendingDoc.fileSize = 0;
        await pendingDoc.save();
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
      .sort({ updatedAt: -1, version: -1 })
      .select("-contentSnapshot -fileData");

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
    const resume = await GeneratedResume.findById(req.params.id).select("-fileData");
    if (!resume || String(resume.student) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }
    res.status(200).json({ success: true, resume: toResumeResponse(resume) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resume-builder/:id/download
 */
const downloadMyResume = async (req, res, next) => {
  try {
    const resume = await GeneratedResume.findById(req.params.id).select("+fileData");
    if (
      !resume ||
      String(resume.student) !== String(req.user._id) ||
      resume.status !== "generated"
    ) {
      return res.status(404).json({ success: false, message: "Resume not found." });
    }

    const disposition = `attachment; filename="${String(resume.fileName || "resume.pdf").replace(/"/g, "")}"`;
    res.setHeader("Content-Type", resume.fileType || "application/pdf");
    res.setHeader("Content-Disposition", disposition);

    if (resume.fileData && resume.fileData.length > 0) {
      res.setHeader("Content-Length", resume.fileData.length);
      return res.end(resume.fileData);
    }

    // Legacy fallback: PDF previously written under uploads/generated-resumes
    try {
      const absolute = resolveSafeFilePath(req.user._id, resume.fileName);
      if (fs.existsSync(absolute)) {
        return fs.createReadStream(absolute).pipe(res);
      }
    } catch {
      /* ignore invalid legacy path */
    }

    return res.status(404).json({
      success: false,
      message: "Resume file is missing from storage.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  aiSummary,
  aiProjectDescription,
  aiExperienceDescription,
  generateResume,
  listMyResumes,
  getMyResume,
  downloadMyResume,
  buildSnapshotFromProfile,
};
