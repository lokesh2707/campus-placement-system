const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const AdminAuditLog = require("../models/AdminAuditLog");
const StudentProfile = require("../models/StudentProfile");
const { ROLES, normalizeRole } = require("../constants/roles");
const { computeProfileCompletion } = require("../utils/profileCompletion");
const { buildCsv, sendCsvDownload, FORMULA_PREFIX } = require("../utils/csv");

const RESUME_DIR = path.join(__dirname, "../uploads/resumes");

/**
 * Helper: ensure officer has an active institute association, or resolve target institute for Super Admin
 */
const getActiveOfficerInstitute = async (user, requestedInstituteId = null) => {
  const isSuperAdmin = user.role === ROLES.SUPER_ADMIN || user.role === "admin";
  if (isSuperAdmin) {
    if (requestedInstituteId) {
      if (!mongoose.Types.ObjectId.isValid(requestedInstituteId)) {
        const err = new Error("Invalid institute ID");
        err.statusCode = 400;
        throw err;
      }
      const institute = await Institute.findById(requestedInstituteId);
      if (!institute || institute.status !== "active") {
        const err = new Error("Requested institute is inactive or does not exist.");
        err.statusCode = 400;
        throw err;
      }
      return institute;
    }
    if (user.institute) {
      const institute = await Institute.findById(user.institute);
      if (institute && institute.status === "active") {
        return institute;
      }
    }
    return null;
  }

  // Strict boundary: Placement Officer is locked to user.institute (ignores requestedInstituteId to prevent parameter tampering)
  if (!user.institute) {
    const err = new Error("Your account is not associated with any institute.");
    err.statusCode = 403;
    throw err;
  }
  const institute = await Institute.findById(user.institute);
  if (!institute || institute.status !== "active") {
    const err = new Error("Your assigned institute is inactive or does not exist.");
    err.statusCode = 403;
    throw err;
  }
  return institute;
};

/**
 * @desc   View all verified platform companies with authorization status for officer's institute
 * @route  GET /api/officer/verified-companies
 * @access Placement Officer and Super Admin
 */
const getVerifiedCompanies = async (req, res, next) => {
  try {
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";

    const companies = await Company.find({ isVerified: true, isActive: true })
      .populate("authorizedInstitutes", "name code")
      .sort({ name: 1 })
      .lean();

    const result = companies.map((comp) => {
      const isAuthorized = institute
        ? comp.authorizedInstitutes?.some(
            (inst) => String(inst._id || inst) === String(institute._id)
          )
        : (comp.authorizedInstitutes?.length > 0);

      return {
        ...comp,
        isAuthorizedForMyInstitute: isSuperAdmin && !institute ? true : !!isAuthorized,
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   View companies authorized for the officer's assigned institute
 * @route  GET /api/officer/authorized-companies
 * @access Placement Officer and Super Admin
 */
const getAuthorizedCompanies = async (req, res, next) => {
  try {
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";

    const filter = { isActive: true };
    if (institute) {
      filter.authorizedInstitutes = institute._id;
    } else if (isSuperAdmin) {
      filter["authorizedInstitutes.0"] = { $exists: true };
    }

    const companies = await Company.find(filter)
      .sort({ name: 1 })
      .lean();

    const companiesWithCounts = await Promise.all(
      companies.map(async (comp) => {
        const [jobCount, recruiterCount] = await Promise.all([
          Job.countDocuments({ company: comp._id }),
          User.countDocuments({ company: comp._id, role: { $in: [ROLES.RECRUITER, "recruiter"] } }),
        ]);
        return {
          ...comp,
          stats: {
            jobs: jobCount,
            recruiters: recruiterCount,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      institute: institute
        ? {
            id: institute._id,
            name: institute.name,
            code: institute.code,
          }
        : null,
      count: companiesWithCounts.length,
      data: companiesWithCounts,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Authorize a verified company for the officer's assigned institute (or specified institute for Super Admin)
 * @route  POST /api/officer/companies/:id/authorize
 * @access Placement Officer and Super Admin
 */
const authorizeCompany = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const requestedInst = isSuperAdmin ? (req.body?.instituteId || req.query?.instituteId) : null;
    if (isSuperAdmin && !requestedInst) {
      return res.status(400).json({
        success: false,
        message: "Please specify instituteId to authorize company for a campus.",
      });
    }

    const institute = await getActiveOfficerInstitute(req.user, requestedInst);
    if (!institute) {
      return res.status(400).json({ success: false, message: "Valid active institute is required" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!company.isActive) {
      return res.status(400).json({
        success: false,
        message: `Cannot authorize inactive company '${company.name}'.`,
      });
    }

    // Only platform-verified companies can be authorized for campus placements
    if (!company.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Only platform-verified companies can be authorized for campus placements.",
      });
    }

    // Prevent duplicate authorizations
    const alreadyAuthorized = company.authorizedInstitutes?.some(
      (instId) => String(instId) === String(institute._id)
    );
    if (alreadyAuthorized) {
      return res.status(400).json({
        success: false,
        message: `Company '${company.name}' is already authorized for ${isSuperAdmin ? institute.name : "your institute"}.`,
      });
    }

    company.authorizedInstitutes.push(institute._id);
    await company.save();

    await AdminAuditLog.create({
      action: "company_authorized",
      performedBy: req.user._id,
      targetCompany: company._id,
      targetInstitute: institute._id,
      details: {
        companyName: company.name,
        instituteName: institute.name,
        officerEmail: req.user.email,
        authorizedByRole: req.user.role,
      },
    });

    res.status(200).json({
      success: true,
      message: `Company '${company.name}' authorized for ${institute.name} successfully`,
      data: {
        companyId: company._id,
        companyName: company.name,
        instituteId: institute._id,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Revoke authorization of a company for the officer's assigned institute (preserves historical jobs & applications)
 * @route  DELETE /api/officer/companies/:id/authorize
 * @access Placement Officer and Super Admin
 */
const revokeCompanyAuthorization = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const requestedInst = isSuperAdmin ? (req.body?.instituteId || req.query?.instituteId) : null;
    if (isSuperAdmin && !requestedInst) {
      return res.status(400).json({
        success: false,
        message: "Please specify instituteId to revoke company authorization.",
      });
    }

    const institute = await getActiveOfficerInstitute(req.user, requestedInst);
    if (!institute) {
      return res.status(400).json({ success: false, message: "Valid active institute is required" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const isAuthorized = company.authorizedInstitutes?.some(
      (instId) => String(instId) === String(institute._id)
    );
    if (!isAuthorized) {
      return res.status(400).json({
        success: false,
        message: `Company '${company.name}' is not currently authorized for ${isSuperAdmin ? institute.name : "your institute"}.`,
      });
    }

    // Revoke authorization without modifying or deleting historical jobs or applications
    company.authorizedInstitutes = company.authorizedInstitutes.filter(
      (instId) => String(instId) !== String(institute._id)
    );
    await company.save();

    await AdminAuditLog.create({
      action: "company_deauthorized",
      performedBy: req.user._id,
      targetCompany: company._id,
      targetInstitute: institute._id,
      details: {
        companyName: company.name,
        instituteName: institute.name,
        officerEmail: req.user.email,
        revokedByRole: req.user.role,
      },
    });

    res.status(200).json({
      success: true,
      message: `Authorization for '${company.name}' revoked for ${institute.name}. Historical records have been preserved.`,
      data: {
        companyId: company._id,
        companyName: company.name,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Register a hiring enterprise / company and authorize it for the officer's institute
 * @route  POST /api/officer/companies
 * @access Placement Officer and Super Admin
 */
const createCompanyForOfficer = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const requestedInst = isSuperAdmin ? (req.body?.instituteId || req.query?.instituteId) : null;
    const institute = await getActiveOfficerInstitute(req.user, requestedInst);
    if (!institute) {
      return res.status(400).json({ success: false, message: "Valid active institute is required" });
    }

    const { name, description, website, location, industry } = req.body;
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    const trimmedName = String(name).trim();
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, "i") } });

    if (company) {
      const alreadyAuthorized = company.authorizedInstitutes?.some(
        (instId) => String(instId) === String(institute._id)
      );

      if (alreadyAuthorized) {
        return res.status(400).json({
          success: false,
          message: `Company '${company.name}' is already registered and authorized for ${isSuperAdmin ? institute.name : "your campus"}.`,
        });
      }

      // If existing company is inactive, reactivate it
      if (!company.isActive) {
        company.isActive = true;
      }

      // Automatically verify and authorize for this campus
      if (!company.isVerified) {
        company.isVerified = true;
        company.verifiedBy = req.user._id;
        company.verifiedAt = new Date();
      }

      company.authorizedInstitutes.push(institute._id);
      await company.save();

      await AdminAuditLog.create({
        action: "company_authorized",
        performedBy: req.user._id,
        targetCompany: company._id,
        targetInstitute: institute._id,
        details: {
          companyName: company.name,
          instituteName: institute.name,
          registeredByOfficer: req.user.email,
          role: req.user.role,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Existing company '${company.name}' has been authorized for ${institute.name} successfully.`,
        data: company,
      });
    }

    // Create new company authorized for the officer's institute
    company = await Company.create({
      name: trimmedName,
      description: description ? String(description).trim() : "",
      website: website ? String(website).trim() : "",
      location: location ? String(location).trim() : "",
      industry: industry ? String(industry).trim() : "Technology",
      createdBy: req.user._id,
      isVerified: true,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
      isActive: true,
      authorizedInstitutes: [institute._id],
    });

    await AdminAuditLog.create({
      action: "company_created",
      performedBy: req.user._id,
      targetCompany: company._id,
      targetInstitute: institute._id,
      details: {
        name: company.name,
        isVerified: company.isVerified,
        createdByRole: req.user.role,
        instituteName: institute.name,
      },
    });

    res.status(201).json({
      success: true,
      message: `Company '${company.name}' registered and authorized for ${institute.name} successfully`,
      data: company,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Provision a Recruiter account for a company authorized by officer's institute
 * @route  POST /api/officer/recruiters
 * @access Placement Officer and Super Admin
 */
const provisionRecruiterForOfficer = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const institute = await getActiveOfficerInstitute(req.user, req.body?.instituteId);
    const { name, email, password, companyId, designation, phone } = req.body;

    if (!name || !email || !companyId) {
      return res.status(400).json({
        success: false,
        message: "Please provide recruiter name, email, and company ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!company.isActive) {
      return res.status(400).json({
        success: false,
        message: `Cannot provision recruiter for inactive company '${company.name}'`,
      });
    }

    if (!company.isVerified) {
      return res.status(400).json({
        success: false,
        message: `Cannot provision recruiter: Company '${company.name}' is not verified by platform administrators.`,
      });
    }

    // CRITICAL BOUNDARY: Officer can only provision recruiters for companies authorized by their institute
    // Super Admin can provision for any verified active company
    if (!isSuperAdmin) {
      const isAuthorized = company.authorizedInstitutes?.some(
        (instId) => String(instId) === String(institute._id)
      );
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: `Cannot provision recruiter: Company '${company.name}' is not authorized for your institute (${institute.name}).`,
        });
      }
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    let tempPassword = password;
    if (!tempPassword || String(tempPassword).trim().length === 0) {
      const randomHex = crypto.randomBytes(4).toString("hex");
      tempPassword = `Recruiter#${randomHex.charAt(0).toUpperCase()}${randomHex.slice(1)}9`;
    } else if (String(tempPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const recruiter = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: tempPassword,
      role: ROLES.RECRUITER,
      company: company._id,
      institute: null, // Recruiters belong to companies, not institutes
      designation: designation ? String(designation).trim() : "Recruiter",
      phone: phone ? String(phone).trim() : "",
      mustChangePassword: true,
      invitedBy: req.user._id,
      isActive: true,
    });

    await AdminAuditLog.create({
      action: "recruiter_provisioned",
      performedBy: req.user._id,
      targetUser: recruiter._id,
      targetCompany: company._id,
      targetInstitute: institute._id,
      details: {
        email: recruiter.email,
        companyName: company.name,
        provisionedByRole: req.user.role,
        instituteName: institute.name,
      },
    });

    res.status(201).json({
      success: true,
      message: `Recruiter '${recruiter.name}' provisioned for '${company.name}'`,
      data: {
        user: {
          id: recruiter._id,
          name: recruiter.name,
          email: recruiter.email,
          role: recruiter.role,
          company: company._id,
          designation: recruiter.designation,
          phone: recruiter.phone,
          isActive: recruiter.isActive,
          mustChangePassword: recruiter.mustChangePassword,
          createdAt: recruiter.createdAt,
        },
        temporaryPassword: tempPassword,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   List recruiters for companies authorized by officer's institute (or all recruiters for Super Admin)
 * @route  GET /api/officer/recruiters
 * @access Placement Officer and Super Admin
 */
const listRecruitersForOfficer = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);

    let filter = {
      role: { $in: [ROLES.RECRUITER, "recruiter"] },
    };

    if (institute) {
      const authorizedCompanyIds = await Company.find({
        authorizedInstitutes: institute._id,
      }).distinct("_id");
      filter.company = { $in: authorizedCompanyIds };
    }

    const recruiters = await User.find(filter)
      .select("name email role designation phone isActive mustChangePassword company createdAt")
      .populate("company", "name industry location isVerified")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: recruiters.length,
      data: recruiters,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   List recruitment drives associated with the officer's institute (or all drives for Super Admin)
 * @route  GET /api/officer/drives
 * @access Placement Officer and Super Admin
 */
const getInstituteDrives = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const {
      company,
      job,
      status: jobStatus,
      batch,
      department,
      applicationStatus,
      page = "1",
      limit = "50",
    } = req.query || {};

    let drivesQuery = {};
    if (institute) {
      // 1. Find all verified companies authorized for this campus
      const authorizedCompanyIds = await Company.find({
        authorizedInstitutes: institute._id,
        isVerified: true,
        isActive: true,
      }).distinct("_id");

      // 2. Query jobs belonging to authorized companies OR targeting this institute
      drivesQuery = {
        $or: [
          { company: { $in: authorizedCompanyIds } },
          { institute: institute._id },
        ],
      };
    } else if (isSuperAdmin) {
      drivesQuery = { status: { $in: ["open", "closed"] } };
    }

    if (company && mongoose.Types.ObjectId.isValid(company)) {
      drivesQuery.company = company;
    }
    if (job && mongoose.Types.ObjectId.isValid(job)) {
      drivesQuery._id = job;
    }
    if (jobStatus && ["open", "closed", "draft"].includes(jobStatus)) {
      drivesQuery.status = jobStatus;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const totalDrives = await Job.countDocuments(drivesQuery);
    const drives = await Job.find(drivesQuery)
      .populate("company", "name industry location website isVerified")
      .populate("postedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 3. Enrich each drive with live application metrics from this campus
    const enriched = await Promise.all(
      drives.map(async (drive) => {
        const appFilter = { job: drive._id };
        if (institute) {
          appFilter.institute = institute._id;
        }
        if (applicationStatus) {
          appFilter.status = applicationStatus;
        }

        let apps = await Application.find(appFilter)
          .select("status studentProfile offerResolution aiEvaluation")
          .populate("studentProfile", "batch department placementStatus");

        if (batch) {
          const batchNum = parseInt(batch, 10);
          apps = apps.filter((a) => a.studentProfile?.batch === batchNum);
        }
        if (department) {
          const deptRe = new RegExp(String(department), "i");
          apps = apps.filter((a) => deptRe.test(a.studentProfile?.department || ""));
        }

        const stageBreakdown = {
          Applied: 0,
          Shortlisted: 0,
          Interview: 0,
          Selected: 0,
          Rejected: 0,
        };
        let eligibleCount = 0;
        let ineligibleCount = 0;
        let pendingOfferResolutions = 0;
        let placedCount = 0;

        apps.forEach((a) => {
          let st = a.status;
          if (st === "Under Review" || st === "Assessment") st = "Shortlisted";
          if (stageBreakdown[st] !== undefined) stageBreakdown[st]++;
          else stageBreakdown[a.status] = (stageBreakdown[a.status] || 0) + 1;

          if (a.aiEvaluation?.isEligible === true) eligibleCount++;
          else if (a.aiEvaluation?.isEligible === false) ineligibleCount++;

          if (a.offerResolution?.durableState === "PENDING") {
            pendingOfferResolutions++;
          }
          if (a.studentProfile?.placementStatus === "placed") {
            placedCount++;
          }
        });

        return {
          ...drive,
          instituteApplicationCount: apps.length,
          stageBreakdown,
          eligibleCount,
          ineligibleCount,
          pendingOfferResolutions,
          placedCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      institute: institute
        ? {
            id: institute._id,
            name: institute.name,
            code: institute.code,
          }
        : null,
      count: enriched.length,
      total: totalDrives,
      page: pageNum,
      pages: Math.ceil(totalDrives / limitNum) || 1,
      data: enriched,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Aggregated recruitment monitoring for officer's institute (live counts)
 * @route  GET /api/officer/recruitment-monitor
 * @access Placement Officer and Super Admin
 */
const getRecruitmentMonitor = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const {
      company,
      job,
      batch,
      department,
      status: applicationStatus,
      page = "1",
      limit = "25",
    } = req.query || {};

    if (!institute && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Institute association required",
      });
    }

    let companyIds = [];
    let jobFilter = {};
    if (institute) {
      companyIds = await Company.find({
        authorizedInstitutes: institute._id,
        isVerified: true,
        isActive: true,
      }).distinct("_id");
      jobFilter = {
        $or: [
          { company: { $in: companyIds } },
          { institute: institute._id },
        ],
      };
    }
    if (company && mongoose.Types.ObjectId.isValid(company)) {
      jobFilter.company = company;
    }
    if (job && mongoose.Types.ObjectId.isValid(job)) {
      jobFilter._id = job;
    }

    const jobs = await Job.find(jobFilter).select("_id title status company").lean();
    const jobIds = jobs.map((j) => j._id);

    const appFilter = { job: { $in: jobIds } };
    if (institute) appFilter.institute = institute._id;
    if (applicationStatus) appFilter.status = applicationStatus;

    let applications = await Application.find(appFilter)
      .populate("student", "name email")
      .populate(
        "studentProfile",
        "rollNumber department batch cgpa placementStatus placementOutcome"
      )
      .populate({
        path: "job",
        select: "title status company",
        populate: { path: "company", select: "name" },
      })
      .select("status aiEvaluation offerResolution createdAt job student studentProfile")
      .sort({ updatedAt: -1 })
      .lean();

    if (batch) {
      const batchNum = parseInt(batch, 10);
      applications = applications.filter((a) => a.studentProfile?.batch === batchNum);
    }
    if (department) {
      const deptRe = new RegExp(String(department), "i");
      applications = applications.filter((a) =>
        deptRe.test(a.studentProfile?.department || "")
      );
    }

    const totals = {
      activeDrives: jobs.filter((j) => j.status === "open").length,
      totalJobPostings: jobs.length,
      participatingCompanies: new Set(
        jobs.map((j) => String(j.company)).filter(Boolean)
      ).size,
      totalApplicants: applications.length,
      eligible: applications.filter((a) => a.aiEvaluation?.isEligible === true).length,
      ineligible: applications.filter((a) => a.aiEvaluation?.isEligible === false).length,
      shortlisted: applications.filter((a) =>
        ["Shortlisted", "Under Review", "Assessment"].includes(a.status)
      ).length,
      interview: applications.filter((a) => a.status === "Interview").length,
      selected: applications.filter((a) => a.status === "Selected").length,
      rejected: applications.filter((a) => a.status === "Rejected").length,
      pendingOfferResolutions: applications.filter(
        (a) => a.offerResolution?.durableState === "PENDING"
      ).length,
      placedOutcomes: applications.filter(
        (a) => a.studentProfile?.placementStatus === "placed"
      ).length,
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const start = (pageNum - 1) * limitNum;
    const pageRows = applications.slice(start, start + limitNum).map((a) => ({
      id: a._id,
      status: a.status,
      studentName: a.student?.name,
      studentEmail: a.student?.email,
      rollNumber: a.studentProfile?.rollNumber,
      department: a.studentProfile?.department,
      batch: a.studentProfile?.batch,
      jobTitle: a.job?.title,
      companyName: a.job?.company?.name,
      matchScore: a.aiEvaluation?.matchScore ?? null,
      eligibilityStatus: a.aiEvaluation?.eligibilityStatus ?? null,
      isEligible: a.aiEvaluation?.isEligible ?? null,
      placementStatus: a.studentProfile?.placementStatus,
      pendingOffer: a.offerResolution?.durableState === "PENDING",
      createdAt: a.createdAt,
    }));

    const pendingOffers = applications
      .filter((a) => a.offerResolution?.durableState === "PENDING")
      .map((a) => ({
        applicationId: a._id,
        studentName: a.student?.name,
        jobTitle: a.job?.title,
        companyName: a.job?.company?.name,
        durableState: a.offerResolution.durableState,
        operationId: a.offerResolution.operationId,
      }));

    res.status(200).json({
      success: true,
      institute: institute
        ? { id: institute._id, name: institute.name, code: institute.code }
        : null,
      totals,
      pendingOffers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: applications.length,
        pages: Math.ceil(applications.length / limitNum) || 1,
      },
      applications: pageRows,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Get single recruitment drive details with candidates from officer's institute
 * @route  GET /api/officer/drives/:jobId
 * @access Placement Officer and Super Admin
 */
const getInstituteDriveDetails = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === ROLES.SUPER_ADMIN || req.user.role === "admin";
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const job = await Job.findById(jobId)
      .populate("company", "name industry location website isVerified authorizedInstitutes")
      .populate("postedBy", "name email role");

    if (!job) {
      return res.status(404).json({ success: false, message: "Recruitment drive not found" });
    }

    // STRICT BOUNDARY CHECK: Placement Officer must belong to associated institute
    if (!isSuperAdmin) {
      const isCompanyAuthorized = job.company?.authorizedInstitutes?.some(
        (instId) => String(instId) === String(institute._id)
      );
      const isJobInstituteMatch = job.institute && String(job.institute) === String(institute._id);

      if (!isCompanyAuthorized && !isJobInstituteMatch) {
        return res.status(403).json({
          success: false,
          message: "This recruitment drive is not authorized or associated with your institute.",
        });
      }
    }

    const appFilter = { job: job._id };
    if (institute) {
      appFilter.institute = institute._id;
    }

    const applications = await Application.find(appFilter)
      .populate("student", "name email")
      .populate("studentProfile", "rollNumber department batch cgpa phone skills placementStatus")
      .populate("resume", "originalFileName storedFileName fileSize isScanned createdAt")
      .sort({ createdAt: -1 });

    const stageBreakdown = {
      Applied: 0,
      Shortlisted: 0,
      Interview: 0,
      Selected: 0,
      Rejected: 0,
    };

    applications.forEach((a) => {
      let st = a.status;
      if (st === "Under Review" || st === "Assessment") st = "Shortlisted";
      if (stageBreakdown[st] !== undefined) stageBreakdown[st]++;
      else stageBreakdown[a.status] = (stageBreakdown[a.status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        job,
        institute: institute
          ? {
              id: institute._id,
              name: institute.name,
              code: institute.code,
            }
          : null,
        applicationCount: applications.length,
        stageBreakdown,
        applications,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   List students belonging to officer's institute with filtering and search
 * @route  GET /api/officer/students
 * @access Placement Officer and Super Admin
 */
const listInstituteStudents = async (req, res, next) => {
  try {
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const query = {};

    if (institute) {
      query.institute = institute._id;
    }

    const {
      search,
      department,
      batch,
      minCgpa,
      maxBacklogs,
      activeBacklogs,
      placementStatus,
      incomplete,
      skill,
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

    if (search && search.trim()) {
      const sTerm = search.trim();
      const sRegex = new RegExp(sTerm, "i");

      const userConditions = [{ name: sRegex }, { email: sRegex }];
      if (institute) {
        userConditions.forEach((c) => (c.institute = institute._id));
      }

      const matchingUsers = await User.find({ $or: userConditions }).select("_id");
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

    if (incomplete === "true") {
      profiles = profiles.filter((p) => {
        const comp = computeProfileCompletion(p);
        return !comp.isComplete;
      });
    }

    const studentsWithCompletion = profiles.map((p) => ({
      ...p.toObject(),
      completion: computeProfileCompletion(p),
    }));

    res.status(200).json({
      success: true,
      count: studentsWithCompletion.length,
      students: studentsWithCompletion,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Get single student academic profile for officer's institute
 * @route  GET /api/officer/students/:id
 * @access Placement Officer and Super Admin
 */
const getInstituteStudentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profile = await StudentProfile.findOne({
      $or: [{ _id: id }, { user: id }],
    }).populate("user", "name email phone isActive institute");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);
    if (callerRole === ROLES.PLACEMENT_OFFICER) {
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

    res.status(200).json({
      success: true,
      student: profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update permitted student academic details by Placement Officer
 * @route  PUT /api/officer/students/:id
 * @access Placement Officer and Super Admin
 */
const updateInstituteStudentAcademic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profile = await StudentProfile.findOne({
      $or: [{ _id: id }, { user: id }],
    }).populate("user", "name email phone");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);
    if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (
        !req.user.institute ||
        !profile.institute ||
        profile.institute.toString() !== req.user.institute.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify students from another institute",
        });
      }
    }

    const { cgpa, backlogs, activeBacklogs, placementStatus, department, batch, reason, source, companyName, organization } = req.body;
    const changes = {};

    // Keep snapshot of original values for strict audit rollback protection
    const originalValues = {
      cgpa: profile.cgpa,
      backlogs: profile.backlogs,
      activeBacklogs: profile.activeBacklogs,
      placementStatus: profile.placementStatus,
      placementOutcome: profile.placementOutcome
        ? JSON.parse(JSON.stringify(profile.placementOutcome))
        : null,
      department: profile.department,
      batch: profile.batch,
    };

    if (cgpa !== undefined) {
      const parsedCgpa = parseFloat(cgpa);
      if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
        return res.status(400).json({
          success: false,
          message: "CGPA must be a valid number between 0.0 and 10.0",
        });
      }
      changes.cgpa = { from: profile.cgpa, to: parsedCgpa };
      profile.cgpa = parsedCgpa;
    }

    if (backlogs !== undefined) {
      const parsedBacklogs = parseInt(backlogs, 10);
      if (isNaN(parsedBacklogs) || parsedBacklogs < 0) {
        return res.status(400).json({
          success: false,
          message: "Backlogs must be a non-negative integer",
        });
      }
      changes.backlogs = { from: profile.backlogs, to: parsedBacklogs };
      profile.backlogs = parsedBacklogs;
    }

    if (activeBacklogs !== undefined) {
      const parsedActive = parseInt(activeBacklogs, 10);
      if (isNaN(parsedActive) || parsedActive < 0) {
        return res.status(400).json({
          success: false,
          message: "Active backlogs must be a non-negative integer",
        });
      }
      changes.activeBacklogs = { from: profile.activeBacklogs, to: parsedActive };
      profile.activeBacklogs = parsedActive;
    }

    if (placementStatus !== undefined) {
      if (!["seeking", "placed", "opted_out"].includes(placementStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid placement status. Allowed values: 'seeking', 'placed', 'opted_out'",
        });
      }

      if (placementStatus !== profile.placementStatus) {
        if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
          return res.status(400).json({
            success: false,
            message: "A mandatory reason of at least 5 characters is required when modifying placement status",
          });
        }

        if (profile.placementStatus === "placed" && ["seeking", "opted_out"].includes(placementStatus)) {
          const hasSelectedApp = await Application.exists({
            studentProfile: profile._id,
            status: "Selected",
          });
          if (hasSelectedApp) {
            return res.status(400).json({
              success: false,
              message: "Student has an active Selected on-campus application. Use the dedicated placement override endpoint (/api/officer/students/:id/placement-override) to resolve on-campus applications before modifying status.",
            });
          }
        }

        changes.placementStatus = { from: profile.placementStatus, to: placementStatus };
        profile.placementStatus = placementStatus;

        const resolvedOrg = (companyName || organization || "").trim();
        if (placementStatus === "placed") {
          profile.placementOutcome = {
            source: source || "administrative_override",
            companyName: resolvedOrg || "Administrative Record",
            application: null,
            recordedBy: req.user._id,
            recordedAt: new Date(),
            reason: reason.trim(),
          };
        } else {
          profile.placementOutcome = {
            source: "none",
            companyName: "",
            application: null,
            recordedBy: req.user._id,
            recordedAt: new Date(),
            reason: reason.trim(),
          };
        }
      }
    }

    if (department && typeof department === "string" && department.trim()) {
      changes.department = { from: profile.department, to: department.trim() };
      profile.department = department.trim();
    }

    if (batch !== undefined) {
      const parsedBatch = parseInt(batch, 10);
      if (!isNaN(parsedBatch) && parsedBatch >= 2000 && parsedBatch <= 2050) {
        changes.batch = { from: profile.batch, to: parsedBatch };
        profile.batch = parsedBatch;
      }
    }

    await profile.save();

    // Audit log with rollback protection:
    // If AdminAuditLog.create fails, the database change must be rolled back.
    try {
      const actionType = changes.placementStatus ? "student_placement_override" : "student_academic_updated";
      await AdminAuditLog.create({
        action: actionType,
        performedBy: req.user._id,
        targetUser: profile.user?._id || profile.user,
        targetInstitute: profile.institute,
        details: {
          studentProfileId: profile._id,
          rollNumber: profile.rollNumber,
          before: originalValues,
          after: {
            cgpa: profile.cgpa,
            backlogs: profile.backlogs,
            activeBacklogs: profile.activeBacklogs,
            placementStatus: profile.placementStatus,
            department: profile.department,
            batch: profile.batch,
          },
          changes,
          reason: reason ? reason.trim() : undefined,
        },
      });
    } catch (auditErr) {
      // Rollback database changes to guarantee no unaudited change persists
      Object.assign(profile, originalValues);
      await profile.save();
      throw auditErr;
    }

    res.status(200).json({
      success: true,
      message: "Student academic details updated successfully",
      student: profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Administrative placement override by Placement Officer or Super Admin
 * @route  PUT /api/officer/students/:id/placement-override
 * @access Protected (Placement Officer & Super Admin)
 */
const recordPlacementOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { placementStatus, reason, source, companyName, organization } = req.body;

    if (!placementStatus || !["seeking", "placed", "opted_out"].includes(placementStatus)) {
      return res.status(400).json({
        success: false,
        message: "A valid placementStatus is required ('seeking', 'placed', 'opted_out')",
      });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A mandatory reason of at least 5 characters is required for an administrative placement override",
      });
    }

    const profile = await StudentProfile.findOne({
      $or: [{ _id: id }, { user: id }],
    }).populate("user", "name email phone institute");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);
    if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (
        !req.user.institute ||
        !profile.institute ||
        profile.institute.toString() !== req.user.institute.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify students from another institute",
        });
      }
    }

    const previousStatus = profile.placementStatus;
    const previousOutcome = profile.placementOutcome
      ? JSON.parse(JSON.stringify(profile.placementOutcome))
      : null;

    const validSources = [
      "on_campus",
      "off_campus",
      "higher_studies",
      "entrepreneurship",
      "competitive_exams",
      "administrative_override",
      "none",
    ];
    let outcomeSource = source;
    if (!outcomeSource || !validSources.includes(outcomeSource)) {
      outcomeSource = placementStatus === "placed" ? "off_campus" : "administrative_override";
    }

    const resolvedOrg = (companyName || organization || "").trim();

    profile.placementStatus = placementStatus;
    profile.placementOutcome = {
      source: outcomeSource,
      companyName: placementStatus === "placed" ? (resolvedOrg || "Off-Campus Employer") : resolvedOrg,
      application: null,
      recordedBy: req.user._id,
      recordedAt: new Date(),
      reason: reason.trim(),
    };

    await profile.save();

    // Audit log with strict rollback protection
    try {
      await AdminAuditLog.create({
        action: "student_placement_override",
        performedBy: req.user._id,
        targetUser: profile.user?._id || profile.user,
        targetInstitute: profile.institute,
        details: {
          studentProfileId: profile._id,
          rollNumber: profile.rollNumber,
          before: {
            placementStatus: previousStatus,
            placementOutcome: previousOutcome,
          },
          after: {
            placementStatus: profile.placementStatus,
            placementOutcome: profile.placementOutcome,
          },
          reason: reason.trim(),
          source: outcomeSource,
          organization: resolvedOrg,
        },
      });
    } catch (auditErr) {
      // Rollback database changes to guarantee no unaudited change persists
      profile.placementStatus = previousStatus;
      profile.placementOutcome = previousOutcome;
      await profile.save();
      throw auditErr;
    }

    res.status(200).json({
      success: true,
      message: `Student placement status overridden to '${placementStatus}' successfully`,
      student: profile,
      completion: computeProfileCompletion(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   View or download student resume for Placement Officer
 * @route  GET /api/officer/students/:id/resume
 * @access Placement Officer and Super Admin
 */
const getInstituteStudentResume = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profile = await StudentProfile.findOne({
      $or: [{ _id: id }, { user: id }],
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const callerRole = normalizeRole(req.user.role);
    if (callerRole === ROLES.PLACEMENT_OFFICER) {
      if (
        !req.user.institute ||
        !profile.institute ||
        profile.institute.toString() !== req.user.institute.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view resumes from another institute",
        });
      }
    }

    if (!profile.resumeUrl) {
      return res.status(404).json({
        success: false,
        message: "Resume document is not available for this student",
      });
    }

    const candidateFile = path.join(RESUME_DIR, path.basename(profile.resumeUrl));
    if (!fs.existsSync(candidateFile)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found on server",
      });
    }

    const filename = profile.resumeFileName || `resume_${profile.rollNumber || "student"}.pdf`;
    const safeFilename = filename.replace(/[^\w.\-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    fs.createReadStream(candidateFile).pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Export students of the officer's institute to CSV
 * @route  GET /api/officer/students/export
 * @access Placement Officer and Super Admin
 */
const exportInstituteStudentsCsv = async (req, res, next) => {
  try {
    const institute = await getActiveOfficerInstitute(req.user, req.query?.instituteId);
    const filter = {};
    if (institute) {
      filter.institute = institute._id;
    }

    if (req.query.department) {
      filter.department = { $regex: String(req.query.department), $options: "i" };
    }
    if (req.query.batch) {
      const b = parseInt(req.query.batch, 10);
      if (!isNaN(b)) filter.batch = b;
    }
    if (req.query.placementStatus) {
      filter.placementStatus = req.query.placementStatus;
    }

    const sanitizeSegment = (value) => {
      const str = value === null || value === undefined ? "" : String(value);
      return FORMULA_PREFIX.test(str) ? `'${str}` : str;
    };

    const profiles = await StudentProfile.find(filter)
      .populate("user", "name email phone isActive")
      .sort({ department: 1, rollNumber: 1 })
      .lean();

    const headers = [
      "rollNumber",
      "name",
      "email",
      "phone",
      "department",
      "degree",
      "batch",
      "cgpa",
      "backlogs",
      "activeBacklogs",
      "skills",
      "placementStatus",
      "hasResume",
      "accountActive",
    ];

    const rows = profiles.map((p) => ({
      rollNumber: p.rollNumber || "",
      name: p.user?.name || "",
      email: p.user?.email || "",
      phone: p.phone || p.user?.phone || "",
      department: p.department || "",
      degree: p.degree || "B.Tech",
      batch: p.batch ?? "",
      cgpa: p.cgpa ?? "",
      backlogs: p.backlogs ?? "",
      activeBacklogs: p.activeBacklogs ?? 0,
      skills: Array.isArray(p.skills) ? p.skills.map(sanitizeSegment).join("; ") : "",
      placementStatus: p.placementStatus || "seeking",
      hasResume: !!(p.resumeUrl && String(p.resumeUrl).trim()) ? "Yes" : "No",
      accountActive: p.user?.isActive === false ? "false" : "true",
    }));

    const csv = buildCsv(headers, rows);
    const instName = institute ? institute.code || institute.name : "campus";
    sendCsvDownload(res, `${instName}-students-report.csv`, csv);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getVerifiedCompanies,
  getAuthorizedCompanies,
  createCompanyForOfficer,
  authorizeCompany,
  revokeCompanyAuthorization,
  provisionRecruiterForOfficer,
  listRecruitersForOfficer,
  getInstituteDrives,
  getInstituteDriveDetails,
  getRecruitmentMonitor,
  listInstituteStudents,
  getInstituteStudentDetails,
  updateInstituteStudentAcademic,
  recordPlacementOverride,
  getInstituteStudentResume,
  exportInstituteStudentsCsv,
};
