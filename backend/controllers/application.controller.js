const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Application = require("../models/Application");
const Job = require("../models/Job");
const StudentProfile = require("../models/StudentProfile");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const GeneratedResume = require("../models/GeneratedResume");
const Company = require("../models/Company");
const AdminAuditLog = require("../models/AdminAuditLog");
const { normalizeRole, ROLES } = require("../constants/roles");
const { isDeadlinePassed, getEffectiveDeadline } = require("../utils/deadline");
const { reconcileJobVacancies } = require("../utils/vacancyReconciliation");
const {
  executeOfferResolutionSideEffects,
  resumePendingOfferResolutions,
} = require("../utils/offerRecovery");
const { isDepartmentAllowed } = require("../utils/departmentMatch");

/**
 * Helper to safely extract MongoDB ObjectId string from reference or object
 */
const getEntityId = (entity) => {
  if (!entity) return null;
  if (typeof entity === "object" && entity._id) {
    return String(entity._id);
  }
  return String(entity);
};

/**
 * Helper to reliably resolve the authoritative institute ID for an application.
 * Checks application.institute, studentProfile.institute, and student.institute.
 * - Collects all established non-null references.
 * - If references conflict (e.g. application.institute says A, studentProfile says B),
 *   it FAILS CLOSED by returning null to prevent unauthorized cross-institute leaks.
 * - If no institute can be established, it FAILS CLOSED by returning null.
 * - If all established references agree (or only one exists, preserving historical data),
 *   it returns the authoritative institute ID string.
 */
const getAuthoritativeInstituteId = (application) => {
  if (!application) return null;

  const appInst = getEntityId(application.institute);
  const profileInst = getEntityId(application.studentProfile?.institute);
  const studentInst = getEntityId(application.student?.institute);

  // Collect all non-null established institute references
  const candidates = [appInst, profileInst, studentInst].filter(Boolean);

  if (candidates.length === 0) {
    // Cannot be established -> fail closed
    return null;
  }

  // Check for conflicts: all established references must agree
  const first = candidates[0];
  const hasConflict = candidates.some((id) => id !== first);
  if (hasConflict) {
    // Conflicting references -> fail closed
    return null;
  }

  return first;
};

/**
 * Reusable authorization helper for application resource access
 * Enforces:
 * - SUPER_ADMIN: platform-wide access
 * - RECRUITER: strictly applications for jobs owned by their own company
 * - PLACEMENT_OFFICER: strictly applications belonging to their assigned institute
 * - STUDENT: only their own applications (when allowStudent = true)
 * 
 * Returns { authorized: boolean, statusCode: number, message: string }
 */
const verifyApplicationAccess = (user, application, { allowStudent = false } = {}) => {
  if (!user || !application) {
    return { authorized: false, statusCode: 403, message: "Unauthorized access" };
  }

  const role = normalizeRole(user.role);

  // 1. Super Admin: Platform-wide supervisor
  if (role === ROLES.SUPER_ADMIN) {
    return { authorized: true };
  }

  // 2. Student self-access (if permitted for endpoint)
  if (role === ROLES.STUDENT) {
    if (!allowStudent) {
      return {
        authorized: false,
        statusCode: 403,
        message: "You are not authorized to manage recruitment application decisions",
      };
    }
    const studentId = getEntityId(application.student);
    const userId = getEntityId(user._id);
    if (studentId && userId && studentId === userId) {
      return { authorized: true };
    }
    return {
      authorized: false,
      statusCode: 403,
      message: "You are not authorized to access this candidate's resume",
    };
  }

  // 3. Recruiter company-level isolation
  if (role === ROLES.RECRUITER) {
    const userCompanyId = getEntityId(user.company);
    const appCompanyId = getEntityId(application.company);

    // Recruiter MUST strictly belong to the company that owns the application/job.
    // A job postedBy reference can never bypass company ownership.
    if (!userCompanyId || !appCompanyId || userCompanyId !== appCompanyId) {
      return {
        authorized: false,
        statusCode: 403,
        message: "You are not authorized to access applications for another company",
      };
    }

    return { authorized: true };
  }

  // 4. Placement Officer institute-level isolation
  if (role === ROLES.PLACEMENT_OFFICER) {
    const userInstituteId = getEntityId(user.institute);
    if (!userInstituteId) {
      return {
        authorized: false,
        statusCode: 403,
        message: "You are not assigned to an active institute",
      };
    }

    const appInstituteId = getAuthoritativeInstituteId(application);
    if (!appInstituteId || appInstituteId !== userInstituteId) {
      return {
        authorized: false,
        statusCode: 403,
        message: "You are not authorized to access applications from another institute",
      };
    }

    return { authorized: true };
  }

  // Any other role
  return {
    authorized: false,
    statusCode: 403,
    message: "You are not authorized to access this resource",
  };
};

/**
 * @desc   Apply for a job
 * @route  POST /api/applications/jobs/:jobId
 * @access Protected (Student only)
 */
const applyToJob = async (req, res, next) => {
  try {
    const jobId = req.params.jobId || req.body.jobId;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required to apply",
      });
    }

    const studentProfile = await StudentProfile.findOne({
      user: req.user._id,
    });
    if (!studentProfile) {
      return res.status(400).json({
        success: false,
        message: "Please complete your Student Profile before applying for jobs.",
      });
    }

    const job = await Job.findById(jobId).populate("company", "name isVerified");
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    if (!job.company || job.company.isVerified !== true) {
      return res.status(403).json({
        success: false,
        message:
          "Applications are not accepted for jobs from unverified companies.",
      });
    }

    if (job.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "This job listing is no longer accepting applications.",
      });
    }

    if (job.deadline && isDeadlinePassed(job.deadline)) {
      return res.status(400).json({
        success: false,
        message: "The application deadline for this job has passed.",
      });
    }

    // Eligibility check
    const criteria = job.eligibilityCriteria || {};
    if (criteria.minCgpa && studentProfile.cgpa < criteria.minCgpa) {
      return res.status(400).json({
        success: false,
        message: `Your CGPA (${studentProfile.cgpa}) does not meet the minimum requirement of ${criteria.minCgpa}`,
      });
    }

    if (criteria.maxBacklogs !== undefined && studentProfile.backlogs > criteria.maxBacklogs) {
      return res.status(400).json({
        success: false,
        message: `Active backlogs (${studentProfile.backlogs}) exceed the maximum permitted (${criteria.maxBacklogs})`,
      });
    }

    if (criteria.allowedDepartments && criteria.allowedDepartments.length > 0) {
      if (!isDepartmentAllowed(studentProfile.department, criteria.allowedDepartments)) {
        return res.status(400).json({
          success: false,
          message: `Your department (${studentProfile.department}) is not eligible for this role. Eligible branches: ${criteria.allowedDepartments.join(", ")}`,
        });
      }
    }

    if (criteria.batch && studentProfile.batch && Number(studentProfile.batch) !== Number(criteria.batch)) {
      return res.status(400).json({
        success: false,
        message: `Your graduation batch (${studentProfile.batch}) is not eligible for this role. Eligible batch: ${criteria.batch}`,
      });
    }

    // Check for existing application
    const existing = await Application.findOne({
      student: req.user._id,
      job: jobId,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this job listing.",
      });
    }

    // Find student's latest resume analysis if available
    const latestResume = await ResumeAnalysis.findOne({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    const application = await Application.create({
      student: req.user._id,
      studentProfile: studentProfile._id,
      job: jobId,
      company: job.company._id || job.company,
      institute: req.user.institute || studentProfile.institute || null,
      resume: latestResume ? latestResume._id : undefined,
      status: "Applied",
      statusHistory: [
        {
          status: "Applied",
          changedAt: new Date(),
          changedBy: req.user._id,
          note: "Application submitted by student",
        },
      ],
    });

    const populated = await Application.findById(application._id)
      .populate("job", "title location employmentType")
      .populate("company", "name industry location");

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all applications submitted by logged-in student
 * @route  GET /api/applications/me
 * @access Protected (Student only)
 */
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate("job", "title location salary employmentType status")
      .populate("company", "name website location industry")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Internal helper to evaluate an application record through Python FastAPI microservice
 */
const evaluateApplicationRecord = async (applicationId, evaluatedByUserId = null) => {
  const application = await Application.findById(applicationId)
    .populate("job")
    .populate("studentProfile")
    .populate("resume");

  if (!application || !application.job || !application.studentProfile) {
    return null;
  }

  const { mlServiceUrl, mlServiceHeaders } = require("../utils/mlClient");
  const studentData = application.studentProfile.toObject
    ? application.studentProfile.toObject()
    : { ...application.studentProfile };
  const jobData = application.job.toObject
    ? application.job.toObject()
    : { ...application.job };

  // Prefer linked resume text; fall back to latest analysis for this student.
  let resumeText = "";
  const ResumeAnalysis = require("../models/ResumeAnalysis");
  if (application.resume) {
    const linked = await ResumeAnalysis.findById(application.resume).select(
      "+extractedText"
    );
    resumeText = linked?.extractedText || "";
  }
  if (!resumeText) {
    const latest = await ResumeAnalysis.findOne({
      user: application.student,
    })
      .sort({ createdAt: -1 })
      .select("+extractedText");
    resumeText = latest?.extractedText || "";
  }

  const payload = {
    student: { ...studentData, resume_text: resumeText },
    job: jobData,
    resume_text: resumeText,
  };

  let evalData = null;
  try {
    const response = await fetch(`${mlServiceUrl()}/evaluate-applicant`, {
      method: "POST",
      headers: mlServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      evalData = await response.json();
      evalData.score_source = evalData.score_source || "ml_service";
    }
  } catch (err) {
    // Fall back to local calculation if ML microservice is unreachable
  }

  if (!evalData) {
    const studentSkills = (studentData.skills || []).map((s) => s.toLowerCase());
    const reqSkills = jobData.requiredSkills || [];
    const prefSkills = jobData.preferredSkills || [];

    const matchedReq = reqSkills.filter((s) =>
      studentSkills.includes(s.toLowerCase())
    );
    const missingReq = reqSkills.filter(
      (s) => !studentSkills.includes(s.toLowerCase())
    );
    const matchedPref = prefSkills.filter((s) =>
      studentSkills.includes(s.toLowerCase())
    );
    const missingPref = prefSkills.filter(
      (s) => !studentSkills.includes(s.toLowerCase())
    );

    let isEligible = true;
    let eligibilityStatus = "Eligible";
    const eligibilityReasons = [];
    const missingData = [];
    const criteria = jobData.eligibilityCriteria || {};

    const minCgpa = criteria.minCgpa ?? jobData.minCgpa ?? 0;
    if (minCgpa > 0 && (studentData.cgpa === undefined || studentData.cgpa === null)) {
      missingData.push("CGPA");
    } else if (minCgpa > 0 && studentData.cgpa < minCgpa) {
      isEligible = false;
      eligibilityReasons.push(
        `CGPA ${studentData.cgpa} is below minimum requirement of ${minCgpa}`
      );
    }

    const depts = criteria.allowedDepartments || [];
    if (depts.length > 0) {
      if (!studentData.department) {
        missingData.push("Department");
      } else if (!isDepartmentAllowed(studentData.department, depts)) {
        isEligible = false;
        eligibilityReasons.push(
          `Department '${studentData.department}' not in eligible list`
        );
      }
    }

    const targetBatch = criteria.batch;
    if (targetBatch) {
      if (!studentData.batch) {
        missingData.push("Graduation Batch");
      } else if (String(studentData.batch) !== String(targetBatch)) {
        isEligible = false;
        eligibilityReasons.push(
          `Batch '${studentData.batch}' does not match required batch ${targetBatch}`
        );
      }
    }

    const maxBacklogs = criteria.maxBacklogs ?? 0;
    const studentBacklogs = studentData.backlogs ?? 0;
    if (studentBacklogs > maxBacklogs) {
      isEligible = false;
      eligibilityReasons.push(
        `Active backlogs (${studentBacklogs}) exceed maximum allowed (${maxBacklogs})`
      );
    }

    if (missingData.length > 0) {
      isEligible = false;
      eligibilityStatus = "Needs review";
      eligibilityReasons.push(
        `Eligibility needs review: missing candidate details (${missingData.join(", ")})`
      );
    } else if (!isEligible) {
      eligibilityStatus = "Not eligible";
    }

    // Offline fallback: same missing-data semantics as Python (no silent 100% for empty lists).
    // Text similarity is unavailable offline — that weight is excluded and remaining weights renormalized.
    // Source label: offline_node (not interchangeable with ml-service scores when text differs).
    const BASE = { required: 0.7, preferred: 0.15, text: 0.15 };
    const active = {};
    let reqPct = 0;
    let prefPct = 0;
    if (reqSkills.length > 0) {
      reqPct = (matchedReq.length / reqSkills.length) * 100;
      active.required = BASE.required;
    }
    if (prefSkills.length > 0) {
      prefPct = (matchedPref.length / prefSkills.length) * 100;
      active.preferred = BASE.preferred;
    }
    // text unavailable offline — do not include BASE.text
    const weightSum = Object.values(active).reduce((a, b) => a + b, 0);
    let matchScore = 0;
    let appliedWeights = {
      required_skills: 0,
      preferred_skills: 0,
      text_similarity: 0,
    };
    if (weightSum > 0) {
      const wReq = (active.required || 0) / weightSum;
      const wPref = (active.preferred || 0) / weightSum;
      matchScore = Math.round(wReq * reqPct + wPref * prefPct);
      appliedWeights = {
        required_skills: Number(wReq.toFixed(4)),
        preferred_skills: Number(wPref.toFixed(4)),
        text_similarity: 0,
      };
    }

    evalData = {
      match_score: matchScore,
      score_source: "offline_node",
      score_weights: appliedWeights,
      baseline_weights: {
        required_skills: 0.7,
        preferred_skills: 0.15,
        text_similarity: 0.15,
      },
      is_eligible: isEligible,
      eligibility_status: eligibilityStatus,
      eligibility_reasons: eligibilityReasons,
      missing_data: missingData,
      matched_required_skills: matchedReq,
      missing_required_skills: missingReq,
      matched_preferred_skills: matchedPref,
      missing_preferred_skills: missingPref,
      text_similarity_percent: 0,
      relevant_evidence: [
        `Profile skills: ${(studentData.skills || []).slice(0, 12).join(", ") || "none listed"}`,
      ],
      explanation: `Offline Node fallback score ${matchScore}% (source: offline_node). Text similarity omitted; active weights renormalized. Not interchangeable with full ML-service scores.`,
      disclaimer:
        "Offline evaluation assist only. Recruiters must review candidates; AI never auto-selects or rejects.",
    };
  }

  const evidenceRaw = evalData.relevant_evidence || [];
  const evidenceStrings = evidenceRaw.map((e) =>
    typeof e === "string" ? e : e.snippet || e.source || JSON.stringify(e)
  );

  application.aiEvaluation = {
    matchScore: evalData.match_score,
    scoreSource: evalData.score_source || "ml_service",
    isEligible: evalData.is_eligible,
    eligibilityStatus:
      evalData.eligibility_status ||
      (evalData.is_eligible ? "Eligible" : "Not eligible"),
    eligibilityReasons: evalData.eligibility_reasons || [],
    missingData: evalData.missing_data || [],
    matchedRequiredSkills: evalData.matched_required_skills || [],
    missingRequiredSkills: evalData.missing_required_skills || [],
    matchedPreferredSkills: evalData.matched_preferred_skills || [],
    missingPreferredSkills: evalData.missing_preferred_skills || [],
    textSimilarityPercent: evalData.text_similarity_percent || 0,
    relevantEvidence: evidenceStrings,
    explanation: evalData.explanation || "",
    evaluatedAt: new Date(),
    evaluatedBy: evaluatedByUserId || application.job.postedBy,
    resumeVersion: application.resume ? application.resume.storedFileName : "",
  };

  await application.save();
  return application;
};

/**
 * @desc   Get applications for a specific job with live AI evaluation metrics
 * @route  GET /api/applications/jobs/:jobId
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const getJobApplications = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, eligibility, minScore, department, sortBy } = req.query;
    const job = await Job.findById(jobId).populate("company", "name isVerified authorizedInstitutes");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    const userRole = normalizeRole(req.user.role);
    const filter = { job: jobId };

    if (userRole === ROLES.SUPER_ADMIN) {
      // Super admin has platform-wide view across all applications
    } else if (userRole === ROLES.RECRUITER) {
      const userCompanyId = getEntityId(req.user.company);
      const jobCompanyId = getEntityId(job.company);

      if (!userCompanyId || !jobCompanyId || userCompanyId !== jobCompanyId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view applications for this job",
        });
      }
    } else if (userRole === ROLES.PLACEMENT_OFFICER) {
      const userInstituteId = getEntityId(req.user.institute);
      if (!userInstituteId) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to an active institute",
        });
      }

      // Check whether this job is associated with the officer's institute
      const isCompanyAuthorized = job.company?.authorizedInstitutes?.some(
        (instId) => String(instId) === userInstituteId
      );
      const isJobInstituteMatch = job.institute && String(job.institute) === userInstituteId;

      if (!isCompanyAuthorized && !isJobInstituteMatch) {
        return res.status(403).json({
          success: false,
          message: "This recruitment drive is not authorized or associated with your institute.",
        });
      }

      // STRICT CAMPUS SCOPING: Officer sees ONLY applications submitted by candidates from their institute
      filter.institute = userInstituteId;
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view applications for this job",
      });
    }

    if (status) filter.status = status;

    let applications = await Application.find(filter)
      .populate("student", "name email phone")
      .populate(
        "studentProfile",
        "rollNumber department batch degree cgpa backlogs activeBacklogs skills technicalSkills resumeUrl resumeFileName resumeFileSize projects experience internships certifications phone institute githubUrl linkedinUrl portfolioUrl educationInstitution graduationYear"
      )
      .populate("resume", "originalFileName storedFileName fileSize extractedSkills isScanned createdAt")
      .sort({ createdAt: -1 });

    // Auto-evaluate any unevaluated applications so recruiter has instant evaluation metrics
    for (const app of applications) {
      if (!app.aiEvaluation || app.aiEvaluation.matchScore === undefined) {
        try {
          await evaluateApplicationRecord(app._id);
        } catch (e) {
          // ignore background evaluation error on list query
        }
      }
    }

    // Refresh if any were evaluated
    applications = await Application.find(filter)
      .populate("student", "name email phone")
      .populate(
        "studentProfile",
        "rollNumber department batch degree cgpa backlogs activeBacklogs skills technicalSkills resumeUrl resumeFileName resumeFileSize projects experience internships certifications phone institute githubUrl linkedinUrl portfolioUrl educationInstitution graduationYear"
      )
      .populate("resume", "originalFileName storedFileName fileSize extractedSkills isScanned createdAt")
      .sort({ createdAt: -1 });

    // Filter by eligibility
    if (eligibility) {
      applications = applications.filter(
        (a) => a.aiEvaluation?.eligibilityStatus === eligibility
      );
    }

    // Filter by minimum AI match score
    if (minScore) {
      const threshold = parseFloat(minScore);
      applications = applications.filter(
        (a) => (a.aiEvaluation?.matchScore ?? 0) >= threshold
      );
    }

    // Filter by department
    if (department) {
      applications = applications.filter((a) =>
        a.studentProfile?.department
          ?.toLowerCase()
          .includes(department.toLowerCase())
      );
    }

    // Sorting
    if (sortBy === "matchScore_desc") {
      applications.sort(
        (a, b) => (b.aiEvaluation?.matchScore ?? 0) - (a.aiEvaluation?.matchScore ?? 0)
      );
    } else if (sortBy === "matchScore_asc") {
      applications.sort(
        (a, b) => (a.aiEvaluation?.matchScore ?? 0) - (b.aiEvaluation?.matchScore ?? 0)
      );
    } else if (sortBy === "cgpa_desc") {
      applications.sort(
        (a, b) => (b.studentProfile?.cgpa ?? 0) - (a.studentProfile?.cgpa ?? 0)
      );
    } else if (sortBy === "name_asc") {
      applications.sort((a, b) =>
        (a.student?.name || "").localeCompare(b.student?.name || "")
      );
    }

    const studentIds = applications.map((a) => a.student?._id || a.student).filter(Boolean);
    const genResumes = await GeneratedResume.find({
      student: { $in: studentIds },
      status: "generated",
    })
      .sort({ updatedAt: -1 })
      .lean();

    const genResumeByStudent = {};
    for (const g of genResumes) {
      const sId = String(g.student);
      if (!genResumeByStudent[sId]) genResumeByStudent[sId] = g;
    }

    const enrichedApplications = applications.map((app) => {
      const appObj = typeof app.toObject === "function" ? app.toObject() : { ...app };
      const sId = String(app.student?._id || app.student);
      const gen = genResumeByStudent[sId];

      const hasDirectResume = Boolean(
        appObj.resume ||
          (appObj.studentProfile?.resumeUrl && String(appObj.studentProfile.resumeUrl).trim())
      );

      const hasResume = hasDirectResume || Boolean(gen);
      const resumeFileName =
        appObj.resume?.originalFileName ||
        appObj.studentProfile?.resumeFileName ||
        gen?.fileName ||
        "Candidate_Resume.pdf";

      appObj.hasResume = hasResume;
      appObj.resumeFileName = resumeFileName;
      appObj.resumeUrl = hasResume ? `/api/applications/${appObj._id}/resume` : null;

      if (gen) {
        if (!appObj.studentProfile) appObj.studentProfile = {};
        if (!appObj.studentProfile.resumeFileName) {
          appObj.studentProfile.resumeFileName = gen.fileName;
        }
        if (!appObj.studentProfile.resumeUrl) {
          appObj.studentProfile.resumeUrl = `/api/applications/${appObj._id}/resume`;
        }
      }

      return appObj;
    });

    res.status(200).json({
      success: true,
      count: enrichedApplications.length,
      job: {
        _id: job._id,
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        eligibilityCriteria: job.eligibilityCriteria,
      },
      applications: enrichedApplications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get comprehensive review details and AI evaluation for a single application
 * @route  GET /api/applications/:id/review
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const getApplicationReview = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("student", "name email institute")
      .populate("studentProfile")
      .populate("job")
      .populate("company", "name industry location website")
      .populate(
        "resume",
        "originalFileName storedFileName fileSize extractedSkills isScanned createdAt"
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const authCheck = verifyApplicationAccess(req.user, application, { allowStudent: false });
    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 403).json({
        success: false,
        message: authCheck.message,
      });
    }

    // Auto-evaluate if evaluation is missing or force recalculate requested
    if (
      !application.aiEvaluation ||
      !application.aiEvaluation.evaluatedAt ||
      req.query.recalculate === "true"
    ) {
      try {
        await evaluateApplicationRecord(application._id, req.user._id);
        const refreshed = await Application.findById(application._id)
          .populate("student", "name email")
          .populate("studentProfile")
          .populate("job")
          .populate("company", "name industry location website")
          .populate(
            "resume",
            "originalFileName storedFileName fileSize extractedSkills isScanned createdAt"
          );
        return res.status(200).json({
          success: true,
          application: refreshed,
        });
      } catch (mlErr) {
        return res.status(200).json({
          success: true,
          application,
          evaluationError: `AI evaluation service unavailable: ${mlErr.message}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Trigger fresh AI evaluation for an application
 * @route  POST /api/applications/:id/evaluate
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const evaluateApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("job")
      .populate("studentProfile", "institute");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const authCheck = verifyApplicationAccess(req.user, application, { allowStudent: false });
    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 403).json({
        success: false,
        message: authCheck.message,
      });
    }

    await evaluateApplicationRecord(application._id, req.user._id);

    const updated = await Application.findById(application._id)
      .populate("student", "name email")
      .populate("studentProfile")
      .populate("job")
      .populate("resume");

    res.status(200).json({
      success: true,
      message: "AI evaluation completed successfully",
      evaluation: updated.aiEvaluation,
      application: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Securely download applicant resume
 * @route  GET /api/applications/:id/resume
 * @access Protected (Student self, Job Owner Recruiter, Placement Officer, Admin)
 */
const downloadApplicantResume = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("job")
      .populate("resume")
      .populate("studentProfile", "institute resumeUrl");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const authCheck = verifyApplicationAccess(req.user, application, { allowStudent: true });
    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 403).json({
        success: false,
        message: authCheck.message,
      });
    }

    let resumeRecord = application.resume;
    if (!resumeRecord) {
      resumeRecord = await ResumeAnalysis.findOne({
        studentProfile: application.studentProfile?._id || application.studentProfile,
      }).sort({ createdAt: -1 });
    }

    let resolvedPath = null;
    let fileName = "candidate_resume.pdf";

    if (resumeRecord && resumeRecord.filePath && fs.existsSync(resumeRecord.filePath)) {
      resolvedPath = path.resolve(resumeRecord.filePath);
      fileName = resumeRecord.originalFileName || "candidate_resume.pdf";
    } else {
      // Check if student profile has resumeUrl
      const profile = application.studentProfile?.resumeUrl !== undefined
        ? application.studentProfile
        : await StudentProfile.findById(application.studentProfile);
      if (profile && profile.resumeUrl) {
        const cleanPath = profile.resumeUrl.replace(/^\/+/, "");
        const candidatePath = path.resolve(__dirname, "..", cleanPath);
        if (fs.existsSync(candidatePath)) {
          resolvedPath = candidatePath;
          fileName = path.basename(candidatePath);
        }
      }
    }

    if (resolvedPath) {
      const safeFilename = fileName.replace(/[^\w.\-]+/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
      return res.sendFile(resolvedPath);
    }

    // Fallback: Check GeneratedResume stored in MongoDB Buffer
    const genResume = await GeneratedResume.findOne({
      student: application.student?._id || application.student,
      status: "generated",
    })
      .select("+fileData")
      .sort({ updatedAt: -1 });

    if (genResume && genResume.fileData && genResume.fileData.length > 0) {
      const safeFilename = (genResume.fileName || "candidate_resume.pdf").replace(/[^\w.\-]+/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
      return res.end(genResume.fileData);
    }

    return res.status(404).json({
      success: false,
      message: "Resume document is not available for this candidate",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update applicant recruitment stage
 * @route  PUT /api/applications/:id/status
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStages = [
      "Applied",
      "Shortlisted",
      "Under Review",
      "Assessment",
      "Interview",
      "Selected",
      "Rejected",
    ];

    if (!validStages.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid recruitment status. Allowed values: ${validStages.join(", ")}`,
      });
    }

    const application = await Application.findById(req.params.id)
      .populate("job")
      .populate("studentProfile", "institute");
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const authCheck = verifyApplicationAccess(req.user, application, { allowStudent: false });
    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 403).json({
        success: false,
        message: authCheck.message,
      });
    }

    // Enforce workflow transitions: APPLIED → SHORTLISTED → INTERVIEW → SELECTED / REJECTED
    const ALLOWED_TRANSITIONS = {
      "Applied": ["Shortlisted", "Under Review", "Assessment", "Interview", "Rejected", "Withdrawn"],
      "Under Review": ["Shortlisted", "Assessment", "Interview", "Selected", "Rejected", "Withdrawn"],
      "Assessment": ["Shortlisted", "Interview", "Selected", "Rejected", "Withdrawn"],
      "Shortlisted": ["Interview", "Assessment", "Selected", "Rejected", "Withdrawn"],
      "Interview": ["Selected", "Rejected", "Shortlisted", "Withdrawn"],
      "Selected": [], // Terminal state in regular progression (offer resolution handled via dedicated workflow)
      "Rejected": [], // Terminal state
      "Withdrawn": [], // Terminal state
      "Offer Declined": [], // Terminal state
      "Offer Revoked": [], // Terminal state
    };

    const currentStatus = application.status || "Applied";
    if (currentStatus !== status) {
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from '${currentStatus}' to '${status}'. Allowed next stages: ${allowedNext.length ? allowedNext.join(", ") : "None (terminal state)"}`,
        });
      }
    }

    // If transitioning to Selected, atomically reserve a vacancy slot on Job
    let reservedOnJob = false;
    if (status === "Selected" && currentStatus !== "Selected") {
      const jobId = application.job._id || application.job;
      const jobDoc = await Job.findById(jobId);
      if (!jobDoc) {
        return res.status(404).json({
          success: false,
          message: "Associated job not found",
        });
      }

      const vacancyLimit = jobDoc.vacancies || 1;

      // Reconcile vacancy reservations: clears any orphaned reservations from prior crashes/failures
      // and registers any historical Selected applications into selectedApplications
      await reconcileJobVacancies(jobId, { dryRun: false });

      // Atomic reservation: ensures selected count strictly < vacancies
      const reservedJob = await Job.findOneAndUpdate(
        {
          _id: jobId,
          selectedApplications: { $ne: application._id },
          $expr: {
            $lt: [
              { $size: { $ifNull: ["$selectedApplications", []] } },
              "$vacancies",
            ],
          },
        },
        {
          $addToSet: { selectedApplications: application._id },
        },
        { returnDocument: "after" }
      );

      if (!reservedJob) {
        return res.status(400).json({
          success: false,
          message: `Cannot select candidate. Vacancy limit of ${vacancyLimit} has been reached for this job listing.`,
        });
      }
      reservedOnJob = true;
    }

    application.status = status;
    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: note || `Stage updated to ${status}`,
    });

    try {
      await application.save();
    } catch (saveErr) {
      if (reservedOnJob) {
        await Job.findByIdAndUpdate(application.job._id || application.job, {
          $pull: { selectedApplications: application._id },
        });
      }
      throw saveErr;
    }

    // If marked Selected, update student placement status and verified placement outcome
    if (status === "Selected") {
      let companyName = "";
      if (application.job) {
        if (application.job.company && typeof application.job.company === "object" && application.job.company.name) {
          companyName = application.job.company.name;
        } else if (application.job.company) {
          const compDoc = await Company.findById(application.job.company).select("name");
          if (compDoc) companyName = compDoc.name;
        }
      }

      await StudentProfile.findByIdAndUpdate(application.studentProfile._id || application.studentProfile, {
        $set: {
          placementStatus: "placed",
          placementOutcome: {
            source: "on_campus",
            companyName: companyName || (application.job?.title ? `Role: ${application.job.title}` : "On-Campus Recruiter"),
            application: application._id,
            recordedBy: req.user._id,
            recordedAt: new Date(),
            reason: note || `Selected for role: ${application.job?.title || "On-Campus Placement"}`,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Applicant moved to ${status} stage`,
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Student withdraws application
 * @route  PUT /api/applications/:id/withdraw
 * @access Protected (Student only)
 */
const withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.status === "Selected" || application.status === "Rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw an application that has already concluded (${application.status}).`,
      });
    }

    application.status = "Withdrawn";
    application.statusHistory.push({
      status: "Withdrawn",
      changedAt: new Date(),
      changedBy: req.user._id,
      note: "Withdrawn by candidate",
    });

    await application.save();

    res.status(200).json({
      success: true,
      message: "Application withdrawn successfully",
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Explicit application offer resolution (Offer Declined or Offer Revoked)
 *         Implements atomic compare-and-set transition and durable crash-recoverable execution.
 * @route  PUT /api/applications/:id/offer-resolution
 * @access Protected (Placement Officer, Recruiter, Super Admin)
 */
const resolveApplicationOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionStatus, reason } = req.body;

    const VALID_RESOLUTIONS = ["Offer Declined", "Offer Revoked"];
    if (!resolutionStatus || !VALID_RESOLUTIONS.includes(resolutionStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid resolution status '${resolutionStatus}'. Permitted values: ${VALID_RESOLUTIONS.join(", ")}`,
      });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A mandatory resolution reason of at least 5 characters is required.",
      });
    }

    // 0. Verify initiating actor reference exists, is active and authorized
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Initiating actor is missing.",
      });
    }

    const actorId = getEntityId(req.user._id);
    if (!mongoose.Types.ObjectId.isValid(actorId)) {
      return res.status(400).json({
        success: false,
        message: "Initiating actor reference is invalid.",
      });
    }

    const initiatingUser = await User.findById(actorId).select("_id role isActive");
    if (!initiatingUser || !initiatingUser.isActive) {
      return res.status(401).json({
        success: false,
        message: "Initiating actor does not exist or is inactive.",
      });
    }

    const permittedRoles = [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_OFFICER, ROLES.RECRUITER];
    if (!permittedRoles.includes(initiatingUser.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${initiatingUser.role}' is not authorized to resolve offers.`,
      });
    }

    // 1. Initial verification & authorization
    const existingApp = await Application.findById(id)
      .populate("job")
      .populate("studentProfile")
      .populate("student");

    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const authCheck = verifyApplicationAccess(req.user, existingApp, { allowStudent: false });
    if (!authCheck.authorized) {
      return res.status(authCheck.statusCode || 403).json({
        success: false,
        message: authCheck.message,
      });
    }

    // 2. Check if already resolved
    if (existingApp.status === resolutionStatus) {
      return res.status(200).json({
        success: true,
        message: `Application offer was already resolved to '${resolutionStatus}'`,
        application: existingApp,
        alreadyResolved: true,
      });
    }

    if (existingApp.status === "Offer Declined" || existingApp.status === "Offer Revoked") {
      return res.status(409).json({
        success: false,
        message: `Cannot resolve offer: application is already resolved with conflicting status '${existingApp.status}'.`,
      });
    }

    if (existingApp.status !== "Selected") {
      return res.status(400).json({
        success: false,
        message: `Only applications with status 'Selected' can undergo offer resolution. Current status is '${existingApp.status}'.`,
      });
    }

    // 3. ATOMIC COMPARE-AND-SET TRANSITION
    // Generates a unique operation ID and atomically transitions status ONLY IF current persisted status is 'Selected'
    const operationId = `res_${Date.now()}_${crypto.randomUUID()}`;
    const now = new Date();

    const updatedApp = await Application.findOneAndUpdate(
      {
        _id: id,
        status: "Selected", // COMPARE condition: strictly Selected
      },
      {
        $set: {
          status: resolutionStatus,
          "offerResolution.operationId": operationId,
          "offerResolution.resolutionStatus": resolutionStatus,
          "offerResolution.reason": reason.trim(),
          "offerResolution.resolvedBy": initiatingUser._id,
          "offerResolution.resolvedAt": now,
          "offerResolution.durableState": "PENDING",
          "offerResolution.actorError": null,
          "offerResolution.steps.applicationUpdated": true,
          "offerResolution.steps.vacancyReleased": false,
          "offerResolution.steps.profileUpdated": false,
          "offerResolution.steps.auditLogged": false,
        },
        $push: {
          statusHistory: {
            status: resolutionStatus,
            changedAt: now,
            changedBy: initiatingUser._id,
            note: reason.trim(),
          },
        },
      },
      { returnDocument: "after" }
    );

    // If null, another concurrent request won the race
    if (!updatedApp) {
      const current = await Application.findById(id);
      if (!current) {
        return res.status(404).json({ success: false, message: "Application not found" });
      }
      if (current.status === resolutionStatus) {
        return res.status(200).json({
          success: true,
          message: `Application offer was already resolved to '${resolutionStatus}'`,
          application: current,
          alreadyResolved: true,
        });
      }
      if (current.status === "Offer Declined" || current.status === "Offer Revoked") {
        return res.status(409).json({
          success: false,
          message: `Cannot resolve offer: application was concurrently resolved with conflicting status '${current.status}'.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot resolve offer: application status is '${current.status}'.`,
      });
    }

    // 4. EXECUTE DURABLE IDEMPOTENT SIDE EFFECTS
    const sideEffectResult = await executeOfferResolutionSideEffects(updatedApp);

    res.status(200).json({
      success: true,
      message: `Offer successfully resolved to '${resolutionStatus}'`,
      application: sideEffectResult.application,
      studentProfile: sideEffectResult.studentProfile,
      vacancyReleased: sideEffectResult.vacancyReleased,
      operationId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyToJob,
  getMyApplications,
  getJobApplications,
  getApplicationReview,
  evaluateApplication,
  downloadApplicantResume,
  updateApplicationStatus,
  withdrawApplication,
  resolveApplicationOffer,
  resumePendingOfferResolutions,
  verifyApplicationAccess,
  getAuthoritativeInstituteId,
  getEntityId,
};
