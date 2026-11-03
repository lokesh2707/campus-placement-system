const fs = require("fs");
const path = require("path");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const StudentProfile = require("../models/StudentProfile");

/**
 * @desc   Upload and parse a PDF, DOC, or DOCX resume
 * @route  POST /api/resumes/upload
 * @access Protected (Student only)
 */
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a resume file (.pdf, .doc, .docx)",
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Verify document structure and magic bytes
    let isValidDocument = false;
    let mimeType = "application/pdf";

    if (ext === ".pdf") {
      // Verify PDF Magic Bytes (%PDF-)
      isValidDocument =
        fileBuffer.length >= 5 &&
        fileBuffer[0] === 0x25 && // %
        fileBuffer[1] === 0x50 && // P
        fileBuffer[2] === 0x44 && // D
        fileBuffer[3] === 0x46 && // F
        fileBuffer[4] === 0x2d;   // -
      mimeType = "application/pdf";
    } else if (ext === ".docx") {
      // Verify DOCX ZIP container (PK\x03\x04)
      isValidDocument =
        fileBuffer.length >= 4 &&
        fileBuffer[0] === 0x50 && // P
        fileBuffer[1] === 0x4b && // K
        fileBuffer[2] === 0x03 &&
        fileBuffer[3] === 0x04;
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (ext === ".doc") {
      // Verify OLE2 header (\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1) or ZIP (renamed docx)
      const isOle =
        fileBuffer.length >= 8 &&
        fileBuffer[0] === 0xd0 &&
        fileBuffer[1] === 0xcf &&
        fileBuffer[2] === 0x11 &&
        fileBuffer[3] === 0xe0 &&
        fileBuffer[4] === 0xa1 &&
        fileBuffer[5] === 0xb1 &&
        fileBuffer[6] === 0x1a &&
        fileBuffer[7] === 0xe1;
      const isPk =
        fileBuffer.length >= 4 &&
        fileBuffer[0] === 0x50 &&
        fileBuffer[1] === 0x4b &&
        fileBuffer[2] === 0x03 &&
        fileBuffer[3] === 0x04;
      isValidDocument = isOle || isPk || fileBuffer.length > 32;
      mimeType = "application/msword";
    } else {
      if (
        fileBuffer.length >= 5 &&
        fileBuffer[0] === 0x25 &&
        fileBuffer[1] === 0x50 &&
        fileBuffer[2] === 0x44 &&
        fileBuffer[3] === 0x46
      ) {
        isValidDocument = true;
        mimeType = "application/pdf";
      } else if (
        fileBuffer.length >= 4 &&
        fileBuffer[0] === 0x50 &&
        fileBuffer[1] === 0x4b &&
        fileBuffer[2] === 0x03 &&
        fileBuffer[3] === 0x04
      ) {
        isValidDocument = true;
        mimeType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
    }

    if (!isValidDocument) {
      // Remove invalid uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message:
          "Invalid file content. The uploaded document is not a genuine PDF or Word document.",
      });
    }

    // Locate student profile
    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "Please complete your Student Profile before uploading a resume.",
      });
    }

    // Call Python FastAPI service (POST /parse-resume)
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, req.file.originalname);

    const { mlServiceUrl, mlServiceHeaders } = require("../utils/mlClient");
    let mlResponse;
    try {
      mlResponse = await fetch(`${mlServiceUrl()}/parse-resume`, {
        method: "POST",
        headers: mlServiceHeaders(),
        body: formData,
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: `AI/ML Resume Parser service is unavailable: ${err.message}`,
      });
    }

    if (!mlResponse.ok) {
      let errorMsg = "Failed to process resume in ML service";
      try {
        const errData = await mlResponse.json();
        errorMsg = errData.detail || errorMsg;
      } catch (e) {
        errorMsg = await mlResponse.text();
      }
      return res.status(mlResponse.status).json({
        success: false,
        message: errorMsg,
      });
    }

    const parseData = await mlResponse.json();

    // Create ResumeAnalysis record (structured fields are unconfirmed heuristics)
    const analysis = await ResumeAnalysis.create({
      user: req.user._id,
      studentProfile: studentProfile._id,
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      extractedSkills: parseData.skills || [],
      categorizedSkills: parseData.categorized_skills || {},
      sections: parseData.sections || {},
      structuredFields: parseData.structured_fields || {},
      extractedText: parseData.extracted_text || "",
      isScanned: parseData.is_scanned || false,
      scanNotice: parseData.scan_notice || parseData.ocr_notice || "",
      ocrSupported: false,
      status: "parsed",
    });

    // Merge newly extracted skills into StudentProfile without duplicates.
    // Do NOT overwrite verified academic fields (CGPA, department, batch, roll)
    // or student-entered projects/experience/certifications with uncertain extract.
    if (parseData.skills && parseData.skills.length > 0) {
      const existingSkills = new Set(studentProfile.skills);
      parseData.skills.forEach((s) => existingSkills.add(s));
      studentProfile.skills = Array.from(existingSkills);
    }
    studentProfile.resumeUrl = req.file.filename;
    studentProfile.resumeFileName = req.file.originalname;
    studentProfile.resumeFileSize = req.file.size;
    studentProfile.resumeUpdatedAt = new Date();
    await studentProfile.save();

    const safeAnalysis = analysis.toObject();
    delete safeAnalysis.extractedText;
    delete safeAnalysis.filePath;

    res.status(201).json({
      success: true,
      message: "Resume uploaded and analyzed successfully",
      analysis: safeAnalysis,
      structuredFields: parseData.structured_fields || {},
      notice:
        "Extracted structured fields are provisional. Confirm skills before treating them as profile truth. Academic records are not overwritten by resume parsing.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get latest resume analysis for current student
 * @route  GET /api/resumes/me
 * @access Protected (Student only)
 */
const getMyResumeAnalysis = async (req, res, next) => {
  try {
    const analysis = await ResumeAnalysis.findOne({ user: req.user._id }).sort({
      createdAt: -1,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "No resume analysis found. Please upload a resume.",
      });
    }

    const safe = analysis.toObject();
    delete safe.extractedText;
    delete safe.filePath;

    res.status(200).json({
      success: true,
      analysis: safe,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Student reviews and edits extracted skills
 * @route  PUT /api/resumes/:id/review
 * @access Protected (Student only)
 */
const reviewExtractedSkills = async (req, res, next) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: "Skills must be provided as an array of strings",
      });
    }

    const analysis = await ResumeAnalysis.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Resume analysis record not found",
      });
    }

    analysis.extractedSkills = skills.map((s) => s.trim()).filter((s) => s.length > 0);
    analysis.status = "reviewed";
    await analysis.save();

    // Also update student profile skills
    await StudentProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { skills: analysis.extractedSkills } }
    );

    res.status(200).json({
      success: true,
      message: "Extracted skills updated and reviewed successfully",
      analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Normalize and validate a short non-empty string.
 */
const cleanStr = (v, max = 300) => {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
};

/**
 * @desc   Confirm / reject / edit structured resume fields into the student profile
 * @route  PUT /api/resumes/:id/confirm-fields
 * @access Protected (owning student only)
 *
 * Confidence is never treated as proof of authenticity. Academic records
 * (CGPA, batch, department, backlogs) are never overwritten from extraction.
 */
const confirmStructuredFields = async (req, res, next) => {
  try {
    const { decisions } = req.body;
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "decisions must be a non-empty array of field decisions",
      });
    }
    if (decisions.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Too many decisions in one request (max 50)",
      });
    }

    const analysis = await ResumeAnalysis.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Resume analysis record not found",
      });
    }

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const structured = analysis.structuredFields || {};
    const applied = [];
    const ALLOWED = new Set([
      "skills",
      "education",
      "experience",
      "projects",
      "internships",
      "certifications",
    ]);
    const ACTIONS = new Set(["confirm", "reject", "edit"]);

    for (const raw of decisions) {
      const category = String(raw.category || "").toLowerCase();
      const action = String(raw.action || "").toLowerCase();
      if (!ALLOWED.has(category) || !ACTIONS.has(action)) {
        return res.status(400).json({
          success: false,
          message: `Invalid decision category/action: ${category}/${action}`,
        });
      }

      const fieldKey = cleanStr(raw.fieldKey || raw.field || "", 80);
      const index =
        raw.index === undefined || raw.index === null
          ? null
          : Number.parseInt(raw.index, 10);

      let confidenceAtDecision = "";
      let storedValue = raw.value ?? null;

      if (category === "skills") {
        let skills =
          action === "reject"
            ? []
            : Array.isArray(raw.values)
              ? raw.values
              : Array.isArray(raw.value)
                ? raw.value
                : analysis.extractedSkills || [];
        skills = [
          ...new Set(
            skills
              .map((s) => cleanStr(s, 60))
              .filter((s) => s.length > 0 && s.length <= 60)
          ),
        ].slice(0, 80);

        if (action === "reject") {
          // Reject extracted set only — do not wipe student-entered skills
          analysis.extractedSkills = [];
          if (structured.skills) structured.skills = [];
        } else if (action === "edit" || action === "confirm") {
          analysis.extractedSkills = skills;
          // Merge into profile; never drop existing verified skills unless edit replaces via replaceAll
          if (raw.replaceAll === true && action === "edit") {
            profile.skills = skills;
          } else {
            const existing = new Set(
              (profile.skills || []).map((s) => s.toLowerCase())
            );
            for (const s of skills) {
              if (!existing.has(s.toLowerCase())) {
                profile.skills.push(s);
                existing.add(s.toLowerCase());
              }
            }
          }
          if (structured.skills && Array.isArray(structured.skills)) {
            structured.skills = structured.skills.map((f) => {
              if (f && typeof f === "object") {
                return { ...f, confirmed: action !== "reject" };
              }
              return f;
            });
          }
        }
        storedValue = skills;
        confidenceAtDecision = "n/a";
      } else if (category === "education") {
        // Never overwrite CGPA / batch / department / backlogs from extraction.
        const edu = structured.education || {};
        const key = fieldKey || "degree";
        if (!["degree", "institution", "graduation_year"].includes(key)) {
          return res.status(400).json({
            success: false,
            message:
              "Education confirmation supports degree, institution, or graduation_year only. Academic CGPA/batch/department are never overwritten from resume extraction.",
          });
        }
        const current = edu[key] || {};
        confidenceAtDecision = current.confidence || "";

        if (action === "reject") {
          if (edu[key]) {
            edu[key] = { ...edu[key], confirmed: false, rejected: true, value: null };
          }
          storedValue = null;
        } else {
          const nextVal =
            action === "edit"
              ? cleanStr(raw.value ?? current.value, 200)
              : cleanStr(current.value, 200);
          if (!nextVal) {
            return res.status(400).json({
              success: false,
              message: `Cannot confirm empty education.${key}`,
            });
          }
          edu[key] = {
            ...current,
            value: nextVal,
            confirmed: true,
            rejected: false,
            source: current.source || "resume_extraction",
          };
          storedValue = nextVal;
          // Persist into structured profile fields. Never touch cgpa/department/batch/backlogs.
          if (key === "degree" && nextVal) {
            profile.degree = nextVal.slice(0, 80);
          } else if (key === "institution" && nextVal) {
            profile.educationInstitution = nextVal.slice(0, 200);
          } else if (key === "graduation_year") {
            const year = Number.parseInt(nextVal, 10);
            if (Number.isNaN(year) || year < 1950 || year > 2050) {
              return res.status(400).json({
                success: false,
                message: "graduation_year must be an integer between 1950 and 2050",
              });
            }
            profile.graduationYear = year;
            // Explicitly do not set profile.batch from extraction
          }
        }
        structured.education = edu;
      } else if (
        category === "experience" ||
        category === "projects" ||
        category === "internships" ||
        category === "certifications"
      ) {
        const listKey =
          category === "internships" ? "internships" : category;
        const list = Array.isArray(structured[listKey])
          ? structured[listKey]
          : [];
        if (index === null || Number.isNaN(index) || index < 0 || index >= list.length) {
          return res.status(400).json({
            success: false,
            message: `Invalid index for ${category}`,
          });
        }
        const item = list[index] || {};
        confidenceAtDecision =
          item.confidence || item.title?.confidence || "";

        if (action === "reject") {
          list[index] = { ...item, confirmed: false, rejected: true };
          structured[listKey] = list;
          storedValue = null;
        } else {
          const title =
            action === "edit"
              ? cleanStr(
                  raw.value?.title ?? item.title?.value ?? item.title,
                  200
                )
              : cleanStr(item.title?.value ?? item.title, 200);
          const description =
            action === "edit"
              ? cleanStr(
                  raw.value?.description ??
                    item.description?.value ??
                    item.description,
                  2000
                )
              : cleanStr(item.description?.value ?? item.description, 2000);

          if (!title) {
            return res.status(400).json({
              success: false,
              message: `${category} title is required to confirm`,
            });
          }

          list[index] = {
            ...item,
            title:
              item.title && typeof item.title === "object"
                ? { ...item.title, value: title, confirmed: true }
                : { value: title, confirmed: true, confidence: confidenceAtDecision },
            description:
              item.description && typeof item.description === "object"
                ? { ...item.description, value: description, confirmed: true }
                : { value: description, confirmed: true },
            confirmed: true,
            rejected: false,
          };
          structured[listKey] = list;
          storedValue = { title, description };

          if (category === "projects") {
            const dup = (profile.projects || []).some(
              (p) => p.title.toLowerCase() === title.toLowerCase()
            );
            if (!dup) {
              profile.projects.push({
                title,
                description,
                technologies: [],
              });
            }
          } else if (category === "experience" || category === "internships") {
            const company =
              cleanStr(raw.value?.company, 120) || "Not specified";
            const role = title;
            const dup = (profile.experience || []).some(
              (e) =>
                e.role.toLowerCase() === role.toLowerCase() &&
                e.company.toLowerCase() === company.toLowerCase()
            );
            if (!dup) {
              profile.experience.push({
                role,
                company,
                description,
                duration: cleanStr(raw.value?.duration, 80),
              });
            }
          } else if (category === "certifications") {
            const dup = (profile.certifications || []).some(
              (c) => c.title.toLowerCase() === title.toLowerCase()
            );
            if (!dup) {
              profile.certifications.push({
                title,
                issuingOrganization: cleanStr(
                  raw.value?.issuingOrganization,
                  120
                ),
              });
            }
          }
        }
      }

      analysis.fieldConfirmations = analysis.fieldConfirmations || [];
      analysis.fieldConfirmations.push({
        category,
        fieldKey,
        index,
        action,
        value: storedValue,
        source: "resume_extraction",
        confidenceAtDecision,
        decidedAt: new Date(),
      });
      applied.push({ category, fieldKey, index, action });
    }

    analysis.structuredFields = structured;
    analysis.status = "reviewed";
    analysis.markModified("structuredFields");
    analysis.markModified("fieldConfirmations");
    await analysis.save();
    await profile.save();

    const safe = analysis.toObject();
    delete safe.extractedText;
    delete safe.filePath;

    res.status(200).json({
      success: true,
      message:
        "Field decisions applied. Extraction confidence is not proof of authenticity.",
      applied,
      analysis: safe,
      profile: {
        skills: profile.skills,
        degree: profile.degree,
        educationInstitution: profile.educationInstitution || "",
        graduationYear: profile.graduationYear ?? null,
        batch: profile.batch,
        cgpa: profile.cgpa,
        department: profile.department,
        projectsCount: profile.projects?.length || 0,
        experienceCount: profile.experience?.length || 0,
        certificationsCount: profile.certifications?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResume,
  getMyResumeAnalysis,
  reviewExtractedSkills,
  confirmStructuredFields,
};
