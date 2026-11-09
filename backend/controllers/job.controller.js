const mongoose = require("mongoose");
const Job = require("../models/Job");
const Company = require("../models/Company");
const Application = require("../models/Application");
const AdminAuditLog = require("../models/AdminAuditLog");
const {
  isCompanyVerified,
  verifiedCompanyJobFilter,
} = require("../utils/verifiedJobs");
const { normalizeRole, ROLES } = require("../constants/roles");
const { verifyJobManagementAccess } = require("../utils/tenantAccess");

/**
 * @desc   Create a company profile (always unverified)
 * @route  POST /api/jobs/companies
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const createCompany = async (req, res, next) => {
  try {
    const { name, description, website, location, industry } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    // Ignore any client-supplied verification fields — recruiters cannot self-verify
    if (
      req.body.isVerified !== undefined ||
      req.body.verifiedBy !== undefined ||
      req.body.verifiedAt !== undefined
    ) {
      // Silently strip; do not honor client values
    }

    const existing = await Company.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A company with this name already exists",
      });
    }

    const company = await Company.create({
      name: name.trim(),
      description,
      website,
      location,
      industry,
      createdBy: req.user._id,
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
    });

    res.status(201).json({
      success: true,
      message:
        "Company created successfully. A Placement Officer must verify it before jobs can be published.",
      company,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get companies (optional verification filter for officers/admins)
 * @route  GET /api/jobs/companies
 * @access Public / Authenticated
 */
const getCompanies = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.isVerified === "true" || req.query.isVerified === "false") {
      filter.isVerified = req.query.isVerified === "true";
    }

    const companies = await Company.find(filter)
      .populate("createdBy", "name email role")
      .populate("verifiedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Approve or revoke company verification
 * @route  PUT /api/jobs/companies/:id/verify
 * @access Protected (Placement Officer, Admin)
 */
const verifyCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
    }

    if (
      req.body === undefined ||
      typeof req.body.isVerified !== "boolean" ||
      Object.keys(req.body).some((key) => key !== "isVerified")
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain only { isVerified: boolean }",
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    company.isVerified = req.body.isVerified;
    if (req.body.isVerified) {
      company.verifiedBy = req.user._id;
      company.verifiedAt = new Date();
    } else {
      company.verifiedBy = req.user._id;
      company.verifiedAt = new Date();
    }
    await company.save();

    // When verification is revoked, existing open jobs must leave public discovery.
    // Soft-close them so recruiters can re-open after re-verification.
    if (!req.body.isVerified) {
      await Job.updateMany(
        { company: company._id, status: "open" },
        { $set: { status: "closed" } }
      );
    }

    await AdminAuditLog.create({
      action: "company_verified",
      performedBy: req.user._id,
      targetCompany: company._id,
      details: {
        companyName: company.name,
        isVerified: company.isVerified,
      },
    });

    const populated = await Company.findById(company._id)
      .populate("createdBy", "name email role")
      .populate("verifiedBy", "name email role");

    res.status(200).json({
      success: true,
      message: req.body.isVerified
        ? "Company approved successfully"
        : "Company verification revoked; open jobs closed from public discovery",
      company: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create a new job listing
 * @route  POST /api/jobs
 * @access Protected (Recruiter, Placement Officer, Admin)
 */
const createJob = async (req, res, next) => {
  try {
    const {
      title,
      companyId,
      description,
      requiredSkills,
      preferredSkills,
      eligibilityCriteria,
      salary,
      location,
      employmentType,
      deadline,
      vacancies,
      recruitmentStages,
      status,
    } = req.body;

    let targetCompanyId = companyId || req.body.company;

    // Recruiters may only create jobs for their assigned company
    if (normalizeRole(req.user.role) === ROLES.RECRUITER) {
      if (req.user.company) {
        if (companyId && String(companyId) !== String(req.user.company)) {
          return res.status(403).json({
            success: false,
            message: "You are not authorized to post jobs for another company's account",
          });
        }
        targetCompanyId = req.user.company;
      }
    }

    if (!title || !targetCompanyId || !description || !location) {
      return res.status(400).json({
        success: false,
        message: "Please provide job title, company, description, and location",
      });
    }

    const company = await Company.findById(targetCompanyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Selected company not found",
      });
    }

    // Recruiters may only create jobs for companies they are assigned to or own
    if (
      normalizeRole(req.user.role) === ROLES.RECRUITER &&
      (!req.user.company || String(req.user.company) !== String(company._id)) &&
      company.createdBy &&
      company.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to post jobs for another company's account",
      });
    }

    const desiredStatus = status === "draft" ? "draft" : "open";

    // Unverified or inactive companies cannot publish open jobs
    if (desiredStatus === "open" && (!isCompanyVerified(company) || company.isActive === false)) {
      return res.status(403).json({
        success: false,
        message:
          "This company is not verified or is inactive. A Super Administrator must verify the company before jobs can be published.",
      });
    }

    // Parse structured eligibility criteria
    const parsedCriteria = {
      minCgpa: eligibilityCriteria?.minCgpa !== undefined ? Number(eligibilityCriteria.minCgpa) : 0,
      maxBacklogs: eligibilityCriteria?.maxBacklogs !== undefined ? Number(eligibilityCriteria.maxBacklogs) : 0,
      allowedDepartments: Array.isArray(eligibilityCriteria?.allowedDepartments)
        ? eligibilityCriteria.allowedDepartments
        : (typeof eligibilityCriteria?.allowedDepartments === "string"
          ? eligibilityCriteria.allowedDepartments.split(",").map((d) => d.trim()).filter(Boolean)
          : []),
      batch: eligibilityCriteria?.batch !== undefined ? Number(eligibilityCriteria.batch) : 2026,
    };

    const job = await Job.create({
      title: title.trim(),
      company: targetCompanyId,
      postedBy: req.user._id,
      description: description.trim(),
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      eligibilityCriteria: parsedCriteria,
      salary: salary || {},
      location: location.trim(),
      employmentType: employmentType || "full-time",
      deadline: deadline ? new Date(deadline) : null,
      vacancies: vacancies ? Math.max(1, parseInt(vacancies, 10) || 1) : 1,
      recruitmentStages: recruitmentStages || undefined,
      status: desiredStatus,
    });

    const populatedJob = await Job.findById(job._id)
      .populate("company", "name website location industry isVerified")
      .populate("postedBy", "name email role");

    res.status(201).json({
      success: true,
      message: "Job listing created successfully",
      job: populatedJob,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get jobs with search & filters
 * @route  GET /api/jobs
 * @access Public / Authenticated
 *
 * Public discovery and students: only open jobs from verified companies.
 * Recruiters: verified open jobs + their own posted jobs (any company status).
 * Officers/admins: may pass includeUnverified=true to see all open jobs.
 */
const getJobs = async (req, res, next) => {
  try {
    const { keyword, skill, employmentType, maxCgpa, mine } = req.query;
    const query = { status: "open" };

    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    if (skill) {
      query.requiredSkills = { $in: [new RegExp(skill, "i")] };
    }

    if (employmentType) {
      query.employmentType = employmentType;
    }

    if (maxCgpa) {
      query["eligibilityCriteria.minCgpa"] = { $lte: parseFloat(maxCgpa) };
    }

    const role = normalizeRole(req.user?.role);
    const includeUnverified =
      req.query.includeUnverified === "true" &&
      (role === ROLES.PLACEMENT_OFFICER || role === ROLES.SUPER_ADMIN);

    if (!includeUnverified) {
      const verifiedFilter = await verifiedCompanyJobFilter();

      if (role === ROLES.RECRUITER && mine === "true") {
        // Recruiter hub: only jobs this recruiter posted
        query.postedBy = req.user._id;
      } else if (role === ROLES.RECRUITER) {
        // General recruiter job browse: verified open jobs OR own postings
        query.$and = [
          ...(query.$and || []),
          {
            $or: [verifiedFilter, { postedBy: req.user._id }],
          },
        ];
      } else {
        Object.assign(query, verifiedFilter);
      }
    }

    const jobs = await Job.find(query)
      .populate("company", "name website location industry isVerified")
      .sort({ createdAt: -1 });

    // Enrich jobs with live application count
    const jobIds = jobs.map((j) => j._id);
    const counts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });

    const enrichedJobs = jobs.map((j) => {
      const obj = j.toObject ? j.toObject() : { ...j };
      obj.applicationCount = countMap[j._id.toString()] || 0;
      return obj;
    });

    res.status(200).json({
      success: true,
      count: enrichedJobs.length,
      jobs: enrichedJobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get single job by ID
 * @route  GET /api/jobs/:id
 * @access Public / Authenticated
 */
const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate(
        "company",
        "name description website location industry isVerified"
      )
      .populate("postedBy", "name email role");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    const companyVerified = isCompanyVerified(job.company);
    const jobCompanyId = job.company?._id || job.company;
    const isOwner =
      req.user &&
      job.postedBy &&
      job.postedBy._id.toString() === req.user._id.toString();
    const isCompanyRecruiter =
      req.user &&
      normalizeRole(req.user.role) === ROLES.RECRUITER &&
      req.user.company &&
      jobCompanyId &&
      String(req.user.company) === String(jobCompanyId);
    const isStaff =
      req.user &&
      (normalizeRole(req.user.role) === ROLES.PLACEMENT_OFFICER ||
        normalizeRole(req.user.role) === ROLES.SUPER_ADMIN);

    if (!companyVerified && !isOwner && !isCompanyRecruiter && !isStaff) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    const applicationCount = await Application.countDocuments({ job: job._id });
    const jobObj = job.toObject ? job.toObject() : { ...job };
    jobObj.applicationCount = applicationCount;

    res.status(200).json({
      success: true,
      job: jobObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a job listing
 * @route  PUT /api/jobs/:id
 * @access Protected (Owner Recruiter, Placement Officer, Admin)
 */
const updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    const company = await Company.findById(job.company).select("isVerified isActive authorizedInstitutes");
    const access = verifyJobManagementAccess({ user: req.user, job, company });
    if (!access.authorized) return res.status(403).json({ success: false, message: access.message });

    // Allow only safe job fields — never company verification metadata via this route
    const allowed = [
      "title",
      "description",
      "requiredSkills",
      "preferredSkills",
      "eligibilityCriteria",
      "salary",
      "location",
      "employmentType",
      "deadline",
      "vacancies",
      "recruitmentStages",
      "status",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.vacancies !== undefined) {
      updates.vacancies = Math.max(1, parseInt(updates.vacancies, 10) || 1);
    }

    if (updates.eligibilityCriteria) {
      const ec = updates.eligibilityCriteria;
      updates.eligibilityCriteria = {
        minCgpa: ec.minCgpa !== undefined ? Number(ec.minCgpa) : (job.eligibilityCriteria?.minCgpa || 0),
        maxBacklogs: ec.maxBacklogs !== undefined ? Number(ec.maxBacklogs) : (job.eligibilityCriteria?.maxBacklogs || 0),
        allowedDepartments: Array.isArray(ec.allowedDepartments)
          ? ec.allowedDepartments
          : (typeof ec.allowedDepartments === "string"
            ? ec.allowedDepartments.split(",").map((d) => d.trim()).filter(Boolean)
            : (job.eligibilityCriteria?.allowedDepartments || [])),
        batch: ec.batch !== undefined ? Number(ec.batch) : (job.eligibilityCriteria?.batch || 2026),
      };
    }

    const nextStatus = updates.status !== undefined ? updates.status : job.status;
    if (nextStatus === "open") {
      const company = await Company.findById(job.company);
      if (!company || !isCompanyVerified(company) || company.isActive === false) {
        return res.status(403).json({
          success: false,
          message:
            "Cannot publish this job: the company is not verified or is inactive. A Super Administrator must verify and activate the company before jobs can be published.",
        });
      }
    }

    job = await Job.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("company", "name website location industry isVerified");

    res.status(200).json({
      success: true,
      message: "Job listing updated successfully",
      job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Publish a draft or closed job
 * @route  PUT /api/jobs/:id/publish
 * @access Protected (Owner Recruiter, Placement Officer, Admin)
 */
const publishJob = async (req, res, next) => {
  req.body = { ...req.body, status: "open" };
  return updateJob(req, res, next);
};

/**
 * @desc   Close an open job
 * @route  PUT /api/jobs/:id/close
 * @access Protected (Owner Recruiter, Placement Officer, Admin)
 */
const closeJob = async (req, res, next) => {
  req.body = { ...req.body, status: "closed" };
  return updateJob(req, res, next);
};

/**
 * @desc   Delete / Archive a job listing
 * @route  DELETE /api/jobs/:id
 * @access Protected (Owner Recruiter, Placement Officer, Admin)
 */
const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    const company = await Company.findById(job.company).select("isVerified isActive authorizedInstitutes");
    const access = verifyJobManagementAccess({ user: req.user, job, company });
    if (!access.authorized) return res.status(403).json({ success: false, message: access.message });

    await job.deleteOne();

    res.status(200).json({
      success: true,
      message: "Job listing removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanies,
  verifyCompany,
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  publishJob,
  closeJob,
};
