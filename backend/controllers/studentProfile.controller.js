const fs = require("fs");
const path = require("path");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const Application = require("../models/Application");
const { normalizeRole, ROLES } = require("../constants/roles");
const { computeProfileCompletion } = require("../utils/profileCompletion");
const {
  hashProjectSource,
  hashExperienceSource,
  validateOptionalHttpsUrl,
} = require("../utils/resumeProfileHelpers");

const RESUME_DIR = path.join(__dirname, "../uploads/resumes");
if (!fs.existsSync(RESUME_DIR)) {
  fs.mkdirSync(RESUME_DIR, { recursive: true });
}

/**
 * Helper to clean and deduplicate an array of string items
 */
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

/**
 * Merge categorized skills into a single flat skills array for search & recommendation compatibility
 */
const aggregateSkills = (profileData) => {
  const allSkills = new Set();
  if (Array.isArray(profileData.skills)) {
    profileData.skills.forEach((s) => typeof s === "string" && s.trim() && allSkills.add(s.trim()));
  }
  const categories = ["technicalSkills", "languages", "frameworks", "databases", "tools"];
  categories.forEach((cat) => {
    if (Array.isArray(profileData[cat])) {
      profileData[cat].forEach((s) => typeof s === "string" && s.trim() && allSkills.add(s.trim()));
    }
  });
  return Array.from(allSkills);
};

/**
 * @desc   Get current logged-in student's profile
 * @route  GET /api/students/profile/me
 * @access Protected (Student only)
 */
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id })
      .populate("user", "name email role institute phone")
      .populate("institute", "name code city state");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found. Please create your profile.",
        completion: computeProfileCompletion(null),
      });
    }

    res.status(200).json({
      success: true,
      profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create or update current student's profile (Upsert with mass assignment defense)
 * @route  PUT /api/students/profile/me
 * @access Protected (Student only)
 */
const upsertMyProfile = async (req, res, next) => {
  try {
    const {
      name,
      rollNumber,
      department,
      degree,
      educationInstitution,
      graduationYear,
      batch,
      cgpa,
      backlogs,
      activeBacklogs,
      phone,
      dateOfBirth,
      gender,
      address,
      skills,
      technicalSkills,
      languages,
      frameworks,
      databases,
      tools,
      projects,
      experience,
      certifications,
      academicHistory,
      placementStatus,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      professionalSummary,
    } = req.body;

    // Mass assignment prevention: Disallow changing role, institute, isVerified, or arbitrary user accounts
    if (req.body.role !== undefined || req.body.institute !== undefined) {
      // Intentionally ignore or defeat malicious role/institute escalation
    }

    // Input validation
    if (cgpa !== undefined) {
      const parsedCgpa = parseFloat(cgpa);
      if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
        return res.status(400).json({
          success: false,
          message: "CGPA must be a valid number between 0.0 and 10.0",
        });
      }
    }

    if (backlogs !== undefined) {
      const parsedBacklogs = parseInt(backlogs, 10);
      if (isNaN(parsedBacklogs) || parsedBacklogs < 0) {
        return res.status(400).json({
          success: false,
          message: "Backlogs must be a non-negative integer",
        });
      }
    }

    if (activeBacklogs !== undefined) {
      const parsedActive = parseInt(activeBacklogs, 10);
      if (isNaN(parsedActive) || parsedActive < 0) {
        return res.status(400).json({
          success: false,
          message: "Active backlogs must be a non-negative integer",
        });
      }
    }

    if (batch !== undefined) {
      const parsedBatch = parseInt(batch, 10);
      if (isNaN(parsedBatch) || parsedBatch < 2000 || parsedBatch > 2050) {
        return res.status(400).json({
          success: false,
          message: "Graduation batch year must be between 2000 and 2050",
        });
      }
    }

    // Sync phone & name to User record if provided
    if (phone !== undefined || (name && typeof name === "string" && name.trim())) {
      const userUpdates = {};
      if (phone !== undefined) userUpdates.phone = String(phone).trim();
      if (name && typeof name === "string" && name.trim()) userUpdates.name = name.trim();
      await User.findByIdAndUpdate(req.user._id, { $set: userUpdates });
    }

    // Build normalized profile fields
    const profileFields = {
      user: req.user._id,
      // Institute is ALWAYS pinned to authenticated user's institute, NEVER request body
      institute: req.user.institute || null,
    };

    if (rollNumber !== undefined) profileFields.rollNumber = String(rollNumber).trim().toUpperCase();
    if (department !== undefined) profileFields.department = String(department).trim();
    if (degree !== undefined) profileFields.degree = String(degree).trim();
    if (educationInstitution !== undefined) {
      profileFields.educationInstitution = String(educationInstitution)
        .trim()
        .slice(0, 200);
    }
    if (graduationYear !== undefined && graduationYear !== null && graduationYear !== "") {
      const parsedGradYear = parseInt(graduationYear, 10);
      if (isNaN(parsedGradYear) || parsedGradYear < 1950 || parsedGradYear > 2050) {
        return res.status(400).json({
          success: false,
          message: "Graduation year must be between 1950 and 2050",
        });
      }
      profileFields.graduationYear = parsedGradYear;
    } else if (graduationYear === null || graduationYear === "") {
      profileFields.graduationYear = null;
    }
    if (batch !== undefined) profileFields.batch = parseInt(batch, 10);
    if (cgpa !== undefined) profileFields.cgpa = parseFloat(cgpa);
    if (backlogs !== undefined) profileFields.backlogs = parseInt(backlogs, 10);
    if (activeBacklogs !== undefined) profileFields.activeBacklogs = parseInt(activeBacklogs, 10);
    if (phone !== undefined) profileFields.phone = String(phone).trim();
    if (dateOfBirth !== undefined) profileFields.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) profileFields.gender = String(gender).trim().toLowerCase();

    if (address && typeof address === "object") {
      profileFields.address = {
        street: address.street ? String(address.street).trim() : "",
        city: address.city ? String(address.city).trim() : "",
        state: address.state ? String(address.state).trim() : "",
        zipCode: address.zipCode ? String(address.zipCode).trim() : "",
        country: address.country ? String(address.country).trim() : "India",
      };
    }

    // Categorized skill collections
    if (technicalSkills !== undefined) profileFields.technicalSkills = cleanStringArray(technicalSkills);
    if (languages !== undefined) profileFields.languages = cleanStringArray(languages);
    if (frameworks !== undefined) profileFields.frameworks = cleanStringArray(frameworks);
    if (databases !== undefined) profileFields.databases = cleanStringArray(databases);
    if (tools !== undefined) profileFields.tools = cleanStringArray(tools);

    // Aggregate flat skills
    const rawSkills = skills !== undefined ? cleanStringArray(skills) : [];
    profileFields.skills = aggregateSkills({
      skills: rawSkills,
      technicalSkills: profileFields.technicalSkills || [],
      languages: profileFields.languages || [],
      frameworks: profileFields.frameworks || [],
      databases: profileFields.databases || [],
      tools: profileFields.tools || [],
    });

    // Optional professional links — empty/omitted means leave existing value unchanged
    const normalizeIncomingUrl = (raw) => {
      if (raw === undefined || raw === null) return raw;
      const trimmed = String(raw).trim();
      if (!trimmed) return "";
      if (/^https:\/\//i.test(trimmed)) return trimmed;
      if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice(7)}`;
      return `https://${trimmed}`;
    };

    const githubCheck = validateOptionalHttpsUrl(normalizeIncomingUrl(githubUrl), {
      fieldLabel: "GitHub URL",
      allowedHosts: ["github.com"],
    });
    if (!githubCheck.ok) {
      return res.status(400).json({ success: false, message: githubCheck.message });
    }
    if (githubCheck.value !== undefined && githubCheck.value !== null) {
      profileFields.githubUrl = githubCheck.value;
    }

    const linkedinCheck = validateOptionalHttpsUrl(normalizeIncomingUrl(linkedinUrl), {
      fieldLabel: "LinkedIn URL",
      allowedHosts: ["linkedin.com"],
    });
    if (!linkedinCheck.ok) {
      return res.status(400).json({ success: false, message: linkedinCheck.message });
    }
    if (linkedinCheck.value !== undefined && linkedinCheck.value !== null) {
      profileFields.linkedinUrl = linkedinCheck.value;
    }

    const portfolioCheck = validateOptionalHttpsUrl(normalizeIncomingUrl(portfolioUrl), {
      fieldLabel: "Portfolio URL",
    });
    if (!portfolioCheck.ok) {
      return res.status(400).json({ success: false, message: portfolioCheck.message });
    }
    if (portfolioCheck.value !== undefined && portfolioCheck.value !== null) {
      profileFields.portfolioUrl = portfolioCheck.value;
    }

    if (professionalSummary !== undefined && professionalSummary !== null) {
      profileFields.professionalSummary = String(professionalSummary).trim().slice(0, 1200);
    }

    // Validated structured sub-documents
    if (Array.isArray(projects)) {
      profileFields.projects = projects
        .map((p) => {
          const title = String(p.title || "").trim();
          const description = String(p.description || "").trim();
          const technologies = cleanStringArray(p.technologies);
          const currentHash = hashProjectSource(title, description, technologies);

          let aiEnhancedDescription = String(p.aiEnhancedDescription || "").trim();
          let aiEnhancedApproved = Boolean(p.aiEnhancedApproved);
          let aiEnhancedSourceHash = String(p.aiEnhancedSourceHash || "").trim();

          // If original content drifted from the hash used at enhance time, mark outdated
          if (aiEnhancedApproved && aiEnhancedSourceHash && aiEnhancedSourceHash !== currentHash) {
            aiEnhancedApproved = false;
          }

          // Only persist enhanced text when student explicitly approved it with matching hash
          if (aiEnhancedApproved && aiEnhancedDescription) {
            if (!aiEnhancedSourceHash) {
              aiEnhancedSourceHash = currentHash;
            }
          } else if (!aiEnhancedApproved) {
            // Keep enhanced draft text if provided for later review, but not as approved
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
            aiEnhancedSourceHash: aiEnhancedApproved ? aiEnhancedSourceHash || currentHash : aiEnhancedSourceHash,
          };
        })
        .filter((p) => p.title.length > 0);
    }

    if (Array.isArray(experience)) {
      profileFields.experience = experience
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
        .filter((exp) => exp.role.length > 0 && exp.company.length > 0);
    }

    if (Array.isArray(certifications)) {
      profileFields.certifications = certifications.map((c) => ({
        title: String(c.title || "").trim(),
        issuingOrganization: String(c.issuingOrganization || "").trim(),
        issueDate: c.issueDate ? new Date(c.issueDate) : null,
        expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        credentialUrl: String(c.credentialUrl || "").trim(),
        credentialId: String(c.credentialId || "").trim(),
      })).filter((c) => c.title.length > 0);
    }

    if (academicHistory && typeof academicHistory === "object") {
      const parseOptionalPercent = (value) => {
        if (value === undefined || value === null || value === "") return null;
        const parsed = parseFloat(value);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
          return undefined; // signal invalid
        }
        return parsed;
      };

      const tenth = parseOptionalPercent(academicHistory.tenthPercentage);
      const twelfth = parseOptionalPercent(academicHistory.twelfthPercentage);
      const diploma = parseOptionalPercent(academicHistory.diplomaPercentage);

      if (tenth === undefined || twelfth === undefined || diploma === undefined) {
        return res.status(400).json({
          success: false,
          message: "Academic percentages must be valid numbers between 0 and 100",
        });
      }

      const trimStr = (v, max = 200) => String(v || "").trim().slice(0, max);
      const parseOptionalYear = (value) => {
        if (value === undefined || value === null || value === "") return null;
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 1950 || parsed > 2050) return undefined;
        return parsed;
      };
      const collegeStartYear = parseOptionalYear(academicHistory.collegeStartYear);
      if (collegeStartYear === undefined) {
        return res.status(400).json({
          success: false,
          message: "College start year must be a valid year between 1950 and 2050",
        });
      }

      profileFields.academicHistory = {
        collegeStartYear,
        intermediateName: trimStr(academicHistory.intermediateName, 200),
        intermediateDuration: trimStr(academicHistory.intermediateDuration, 60),
        schoolName: trimStr(academicHistory.schoolName, 200),
        schoolDuration: trimStr(academicHistory.schoolDuration, 60),
        tenthPercentage: tenth,
        twelfthPercentage: twelfth,
        diplomaPercentage: diploma,
        semesters: Array.isArray(academicHistory.semesters)
          ? academicHistory.semesters
              .map((s) => {
                const semester = parseInt(s.semester, 10);
                const sgpa = parseFloat(s.sgpa);
                if (
                  Number.isNaN(semester) ||
                  Number.isNaN(sgpa) ||
                  semester < 1 ||
                  semester > 10 ||
                  sgpa < 0 ||
                  sgpa > 10
                ) {
                  return null;
                }
                return { semester, sgpa };
              })
              .filter(Boolean)
          : [],
      };
    }

    if (placementStatus) {
      if (placementStatus === "placed") {
        return res.status(400).json({
          success: false,
          message: "Students cannot self-declare 'placed' status. Verified placement is established through on-campus recruiter selection or placement officer verification.",
        });
      }

      // Check if student is already placed
      const existingProfile = await StudentProfile.findOne({ user: req.user._id });
      if (existingProfile && existingProfile.placementStatus === "placed") {
        return res.status(400).json({
          success: false,
          message: "Cannot modify verified placement status. Please contact your campus placement officer for status adjustments.",
        });
      }

      // Check if student has an active Selected application preventing status change
      if (existingProfile) {
        const hasSelectedApp = await Application.exists({
          studentProfile: existingProfile._id,
          status: "Selected",
        });
        if (hasSelectedApp) {
          return res.status(400).json({
            success: false,
            message: "Cannot modify placement status while having an active Selected placement application. Please contact your campus placement officer.",
          });
        }
      }

      if (["seeking", "opted_out"].includes(placementStatus)) {
        profileFields.placementStatus = placementStatus;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid placement status. Permitted values: 'seeking', 'opted_out'",
        });
      }
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: profileFields },
      { returnDocument: "after", upsert: true, runValidators: true }
    ).populate("user", "name email role institute phone");

    res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get profile completion status and breakdown
 * @route  GET /api/students/profile/completion
 * @access Protected (Student only)
 */
const getProfileCompletionStatus = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    const completion = computeProfileCompletion(profile);

    res.status(200).json({
      success: true,
      completion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Upload or replace student PDF resume
 * @route  POST /api/students/profile/resume
 * @access Protected (Student only)
 */
const uploadStudentResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a PDF resume file to upload",
      });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Verify PDF Magic Bytes (%PDF-)
    const isPdfMagic =
      fileBuffer.length >= 5 &&
      fileBuffer[0] === 0x25 && // %
      fileBuffer[1] === 0x50 && // P
      fileBuffer[2] === 0x44 && // D
      fileBuffer[3] === 0x46 && // F
      fileBuffer[4] === 0x2d;   // -

    if (!isPdfMagic) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // ignore deletion error
      }
      return res.status(400).json({
        success: false,
        message: "Invalid file content. Uploaded file is not a genuine PDF document.",
      });
    }

    // Locate student profile
    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
      return res.status(400).json({
        success: false,
        message: "Please initialize your Student Profile before uploading a resume.",
      });
    }

    // Clean up previous resume file from disk if present
    if (profile.resumeUrl && profile.resumeUrl !== req.file.filename) {
      const oldPath = path.join(RESUME_DIR, path.basename(profile.resumeUrl));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          // ignore unlink error
        }
      }
    }

    // Update profile
    profile.resumeUrl = req.file.filename;
    profile.resumeFileName = req.file.originalname;
    profile.resumeFileSize = req.file.size;
    profile.resumeUpdatedAt = new Date();
    await profile.save();

    // Graceful ResumeAnalysis creation/sync (does not crash if ML service is offline)
    try {
      await ResumeAnalysis.findOneAndUpdate(
        { user: req.user._id },
        {
          $set: {
            studentProfile: profile._id,
            originalFileName: req.file.originalname,
            storedFileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            status: "parsed",
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch (analysisErr) {
      // Non-fatal: local analysis creation failed
    }

    res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      resume: {
        fileName: profile.resumeFileName,
        fileSize: profile.resumeFileSize,
        uploadedAt: profile.resumeUpdatedAt,
        resumeUrl: profile.resumeUrl,
      },
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete student resume
 * @route  DELETE /api/students/profile/resume
 * @access Protected (Student only)
 */
const deleteStudentResume = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile || !profile.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: "No uploaded resume found to delete",
      });
    }

    // Unlink file from local disk
    const targetFile = path.join(RESUME_DIR, path.basename(profile.resumeUrl));
    if (fs.existsSync(targetFile)) {
      try {
        fs.unlinkSync(targetFile);
      } catch (err) {
        // continue even if file already missing
      }
    }

    // Clear resume metadata on profile
    profile.resumeUrl = "";
    profile.resumeFileName = "";
    profile.resumeFileSize = 0;
    profile.resumeUpdatedAt = null;
    await profile.save();

    // Clean up analysis record
    await ResumeAnalysis.deleteOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      message: "Resume deleted successfully",
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Download or stream student resume (Self or authorized viewer)
 * @route  GET /api/students/profile/resume OR GET /api/students/:id/resume
 * @access Protected (Student self, Placement Officer same campus, Super Admin)
 */
const downloadStudentResume = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    let profile;

    if (!targetId || targetId === "me") {
      profile = await StudentProfile.findOne({ user: req.user._id });
    } else {
      profile = await StudentProfile.findOne({
        $or: [{ _id: targetId }, { user: targetId }],
      });
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);

    // STUDENT: Can only download their own resume
    if (callerRole === ROLES.STUDENT) {
      if (profile.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access another student's resume",
        });
      }
    }
    // PLACEMENT_OFFICER: Can only access resumes of students from their own assigned institute
    else if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (
        !req.user.institute ||
        !profile.institute ||
        profile.institute.toString() !== req.user.institute.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access resumes from another institute",
        });
      }
    }
    // SUPER_ADMIN: Platform-wide access
    else if (callerRole === ROLES.SUPER_ADMIN) {
      // Allowed
    }
    // RECRUITER or other unauthorized roles: Blocked from direct student profile resume endpoint
    else {
      return res.status(403).json({
        success: false,
        message:
          "Recruiters can only access applicant resumes through submitted job applications, not directly via student directory",
      });
    }

    if (!profile.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: "Resume document is not available for this student",
      });
    }

    // Resolve file path
    const candidateFile = path.join(RESUME_DIR, path.basename(profile.resumeUrl));
    if (!fs.existsSync(candidateFile)) {
      return res.status(404).json({
        success: false,
        message: "Resume file could not be found on storage disk",
      });
    }

    const filename = profile.resumeFileName || `resume_${profile.rollNumber || "student"}.pdf`;
    const safeFilename = filename.replace(/[^\w.\-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    const stream = fs.createReadStream(candidateFile);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update categorized technical skills
 * @route  PUT /api/students/profile/skills
 * @access Protected (Student only)
 */
const updateMySkills = async (req, res, next) => {
  try {
    const { skills, technicalSkills, languages, frameworks, databases, tools } = req.body;

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    if (technicalSkills !== undefined) profile.technicalSkills = cleanStringArray(technicalSkills);
    if (languages !== undefined) profile.languages = cleanStringArray(languages);
    if (frameworks !== undefined) profile.frameworks = cleanStringArray(frameworks);
    if (databases !== undefined) profile.databases = cleanStringArray(databases);
    if (tools !== undefined) profile.tools = cleanStringArray(tools);

    const baseSkills = skills !== undefined ? cleanStringArray(skills) : profile.skills || [];
    profile.skills = aggregateSkills({
      skills: baseSkills,
      technicalSkills: profile.technicalSkills,
      languages: profile.languages,
      frameworks: profile.frameworks,
      databases: profile.databases,
      tools: profile.tools,
    });

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Skills updated successfully",
      skills: profile.skills,
      categorizedSkills: {
        technicalSkills: profile.technicalSkills,
        languages: profile.languages,
        frameworks: profile.frameworks,
        databases: profile.databases,
        tools: profile.tools,
      },
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update student projects
 * @route  PUT /api/students/profile/projects
 * @access Protected (Student only)
 */
const updateMyProjects = async (req, res, next) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects)) {
      return res.status(400).json({
        success: false,
        message: "Projects must be provided as an array",
      });
    }

    const validated = [];
    for (const p of projects) {
      if (!p.title || !String(p.title).trim()) {
        return res.status(400).json({
          success: false,
          message: "Each project must have a valid title",
        });
      }
      const title = String(p.title).trim();
      const description = String(p.description || "").trim();
      const technologies = cleanStringArray(p.technologies);
      const currentHash = hashProjectSource(title, description, technologies);
      let aiEnhancedDescription = String(p.aiEnhancedDescription || "").trim();
      let aiEnhancedApproved = Boolean(p.aiEnhancedApproved);
      let aiEnhancedSourceHash = String(p.aiEnhancedSourceHash || "").trim();
      if (aiEnhancedApproved && aiEnhancedSourceHash && aiEnhancedSourceHash !== currentHash) {
        aiEnhancedApproved = false;
      }
      validated.push({
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
      });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { projects: validated } },
      { returnDocument: "after", runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Projects updated successfully",
      projects: profile.projects,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update student certifications
 * @route  PUT /api/students/profile/certifications
 * @access Protected (Student only)
 */
const updateMyCertifications = async (req, res, next) => {
  try {
    const { certifications } = req.body;
    if (!Array.isArray(certifications)) {
      return res.status(400).json({
        success: false,
        message: "Certifications must be provided as an array",
      });
    }

    const validated = [];
    for (const c of certifications) {
      if (!c.title || !String(c.title).trim()) {
        return res.status(400).json({
          success: false,
          message: "Each certification must have a valid title",
        });
      }
      validated.push({
        title: String(c.title).trim(),
        issuingOrganization: String(c.issuingOrganization || "").trim(),
        issueDate: c.issueDate ? new Date(c.issueDate) : null,
        expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        credentialUrl: String(c.credentialUrl || "").trim(),
        credentialId: String(c.credentialId || "").trim(),
      });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { certifications: validated } },
      { returnDocument: "after", runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Certifications updated successfully",
      certifications: profile.certifications,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all student profiles with filtering and strict role scoping
 * @route  GET /api/students
 * @access Protected (Placement Officer scoped to campus, Super Admin platform-wide)
 */
const getAllProfiles = async (req, res, next) => {
  try {
    const callerRole = normalizeRole(req.user.role);

    // Strict RBAC: Recruiters and students cannot access unrestricted student directory
    if (callerRole === ROLES.RECRUITER) {
      return res.status(403).json({
        success: false,
        message: "Recruiters cannot access the unrestricted student directory",
      });
    }
    if (callerRole === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        message: "Students cannot access the student directory",
      });
    }

    const query = {};

    // Placement Officer: ALWAYS scoped to their assigned institute
    if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (!req.user.institute) {
        return res.status(403).json({
          success: false,
          message: "Placement Officer has no assigned institute",
        });
      }
      query.institute = req.user.institute;
    } else if (callerRole === ROLES.SUPER_ADMIN && req.query.instituteId) {
      query.institute = req.query.instituteId;
    }

    const {
      search,
      department,
      batch,
      minCgpa,
      maxBacklogs,
      activeBacklogs,
      skill,
      placementStatus,
      incomplete,
    } = req.query;

    if (department) query.department = new RegExp(department, "i");
    if (batch) query.batch = parseInt(batch, 10);
    if (minCgpa) query.cgpa = { $gte: parseFloat(minCgpa) };
    if (maxBacklogs !== undefined && maxBacklogs !== "") query.backlogs = { $lte: parseInt(maxBacklogs, 10) };
    if (activeBacklogs !== undefined && activeBacklogs !== "") query.activeBacklogs = { $lte: parseInt(activeBacklogs, 10) };
    if (placementStatus) query.placementStatus = placementStatus;
    if (skill) {
      const sRegex = new RegExp(skill, "i");
      query.$or = [
        { skills: { $regex: sRegex } },
        { technicalSkills: { $regex: sRegex } },
        { languages: { $regex: sRegex } },
        { frameworks: { $regex: sRegex } },
      ];
    }

    // Search by student name, email, or roll number
    if (search && search.trim()) {
      const sTerm = search.trim();
      const sRegex = new RegExp(sTerm, "i");

      // Find matching users
      const matchingUsers = await User.find({
        $or: [{ name: sRegex }, { email: sRegex }],
      }).select("_id");

      const userIds = matchingUsers.map((u) => u._id);

      const searchConditions = [{ rollNumber: sRegex }, { user: { $in: userIds } }];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    let profiles = await StudentProfile.find(query)
      .populate("user", "name email phone isActive")
      .sort({ cgpa: -1, rollNumber: 1 });

    // Optional filter for incomplete profiles
    if (incomplete === "true") {
      profiles = profiles.filter((p) => {
        const comp = computeProfileCompletion(p);
        return !comp.isComplete;
      });
    }

    // Attach completion summaries for convenience
    const profilesWithCompletion = profiles.map((p) => ({
      ...p.toObject(),
      completion: computeProfileCompletion(p),
    }));

    res.status(200).json({
      success: true,
      count: profilesWithCompletion.length,
      profiles: profilesWithCompletion,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get student profile by ID with strict role & institute isolation
 * @route  GET /api/students/:id
 * @access Protected (Student self, Placement Officer same campus, Super Admin)
 */
const getProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const profile = await StudentProfile.findOne({
      $or: [{ _id: id }, { user: id }],
    }).populate("user", "name email role institute phone");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);

    // STUDENT: Can only view own profile
    if (callerRole === ROLES.STUDENT) {
      if (profile.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view another student's profile",
        });
      }
    }
    // PLACEMENT_OFFICER: Can only view profiles of students from their own assigned institute
    else if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (
        !req.user.institute ||
        !profile.institute ||
        profile.institute.toString() !== req.user.institute.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view students from another institute",
        });
      }
    }
    // SUPER_ADMIN: Allowed platform-wide
    else if (callerRole === ROLES.SUPER_ADMIN) {
      // Allowed
    }
    // RECRUITER: Blocked from direct unrestricted student profile access
    else {
      return res.status(403).json({
        success: false,
        message: "Recruiters cannot access student profiles through unrestricted endpoints",
      });
    }

    res.status(200).json({
      success: true,
      profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
