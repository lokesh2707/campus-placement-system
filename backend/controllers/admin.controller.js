const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/User");
const Company = require("../models/Company");
const Job = require("../models/Job");
const Application = require("../models/Application");
const StudentProfile = require("../models/StudentProfile");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const AdminAuditLog = require("../models/AdminAuditLog");
const Institute = require("../models/Institute");
const { ROLES, ALL_ROLES, normalizeRole } = require("../constants/roles");

const ALLOWED_ROLES = [
  ...ALL_ROLES,
  "student",
  "recruiter",
  "placement_officer",
  "admin",
];

const SAFE_USER_FIELDS = "name email role isActive createdAt updatedAt";

/**
 * @desc   List users with pagination and safe filters
 * @route  GET /api/admin/users
 * @access Admin only
 */
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitRaw = parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(Math.max(1, limitRaw), 100);

    const filter = {};

    if (req.query.role !== undefined && req.query.role !== "") {
      if (!ALLOWED_ROLES.includes(req.query.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role filter. Allowed: ${ALLOWED_ROLES.join(", ")}`,
        });
      }
      const normalizedQueryRole = normalizeRole(req.query.role);
      const legacyQueryMap = {
        SUPER_ADMIN: ["SUPER_ADMIN", "admin"],
        PLACEMENT_OFFICER: ["PLACEMENT_OFFICER", "placement_officer"],
        RECRUITER: ["RECRUITER", "recruiter"],
        STUDENT: ["STUDENT", "student"],
      };
      const matchingRoles = legacyQueryMap[normalizedQueryRole] || [req.query.role];
      filter.role = { $in: matchingRoles };
    }

    if (req.query.isActive !== undefined && req.query.isActive !== "") {
      if (req.query.isActive !== "true" && req.query.isActive !== "false") {
        return res.status(400).json({
          success: false,
          message: "isActive filter must be 'true' or 'false'",
        });
      }
      filter.isActive = req.query.isActive === "true";
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(SAFE_USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Activate or deactivate a user account
 * @route  PUT /api/admin/users/:id/status
 * @access Admin only
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Accept only the intended status field — ignore any other body properties
    if (
      req.body === undefined ||
      typeof req.body.isActive !== "boolean" ||
      Object.keys(req.body).some((key) => key !== "isActive")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Request body must contain only { isActive: boolean }",
      });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate or change the status of your own account",
      });
    }
    
    const user = await User.findById(id).select(SAFE_USER_FIELDS);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const previousStatus = user.isActive;
    user.isActive = req.body.isActive;
    await user.save();

    await AdminAuditLog.create({
      action: "user_status_change",
      performedBy: req.user._id,
      targetUser: user._id,
      details: {
        previousIsActive: previousStatus,
        newIsActive: user.isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: `User account ${user.isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Change a user's role
 * @route  PUT /api/admin/users/:id/role
 * @access Admin only
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      req.body === undefined ||
      typeof req.body.role !== "string" ||
      Object.keys(req.body).some((key) => key !== "role")
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain only { role: string }",
      });
    }

    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}`,
      });
    }

    // Prevent self-promotion / self-demotion
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const user = await User.findById(id).select(SAFE_USER_FIELDS);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    await AdminAuditLog.create({
      action: "user_role_change",
      performedBy: req.user._id,
      targetUser: user._id,
      details: {
        previousRole,
        newRole: user.role,
      },
    });

    res.status(200).json({
      success: true,
      message: `User role updated from '${previousRole}' to '${user.role}'`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Administrator overview aggregates
 * @route  GET /api/admin/overview
 * @access Admin only
 */
const getAdminOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      students,
      recruiters,
      placementOfficers,
      administrators,
      activeUsers,
      inactiveUsers,
      totalCompanies,
      verifiedCompanies,
      totalJobs,
      activeJobs,
      totalInstitutes,
      totalApplications,
      activeApplications,
      selectedApplications,
      placedStudents,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $in: [ROLES.STUDENT, "student"] } }),
      User.countDocuments({ role: { $in: [ROLES.RECRUITER, "recruiter"] } }),
      User.countDocuments({ role: { $in: [ROLES.PLACEMENT_OFFICER, "placement_officer"] } }),
      User.countDocuments({ role: { $in: [ROLES.SUPER_ADMIN, "admin"] } }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Company.countDocuments(),
      Company.countDocuments({ isVerified: true, isActive: true }),
      Job.countDocuments(),
      Job.countDocuments({ status: "open" }),
      Institute.countDocuments({ status: "active" }),
      Application.countDocuments(),
      Application.countDocuments({
        status: {
          $in: [
            "Applied",
            "Shortlisted",
            "Under Review",
            "Assessment",
            "Interview",
            "Selected",
          ],
        },
      }),
      Application.countDocuments({ status: "Selected" }),
      StudentProfile.countDocuments({ placementStatus: "placed" }),
    ]);

    res.status(200).json({
      success: true,
      definitions: {
        verifiedCompanies: "Companies with isVerified=true and isActive=true.",
        activeJobs: "Jobs with status open (platform-wide).",
        activeApplications:
          "Applications excluding Withdrawn, Rejected, Offer Declined, Offer Revoked.",
        selectedApplications:
          "status=Selected; distinct from placedStudents (placementStatus=placed).",
        placedStudents: "Unique profiles with placementStatus=placed.",
      },
      data: {
        users: {
          total: totalUsers,
          students,
          recruiters,
          placementOfficers,
          administrators,
          active: activeUsers,
          inactive: inactiveUsers,
        },
        institutes: totalInstitutes,
        companies: totalCompanies,
        verifiedCompanies,
        jobs: totalJobs,
        activeJobs,
        applications: totalApplications,
        activeApplications,
        selectedApplications,
        placedStudents,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create an administrative user (Placement Officer or Super Admin)
 * @route  POST /api/admin/users/create
 * @access Admin only
 */
const createPrivilegedUser = async (req, res, next) => {
  try {
    const { name, email, password, role, institute, designation, phone } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide full name, email, and role",
      });
    }

    const normalizedRole = normalizeRole(role);
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_OFFICER];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'SUPER_ADMIN' or 'PLACEMENT_OFFICER'",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    let instituteId = null;
    let targetInstitute = null;

    if (normalizedRole === ROLES.PLACEMENT_OFFICER) {
      if (!institute) {
        return res.status(400).json({
          success: false,
          message: "Placement Officer accounts must be associated with an active institute",
        });
      }
      if (!mongoose.Types.ObjectId.isValid(institute)) {
        return res.status(400).json({
          success: false,
          message: "Invalid institute identifier provided",
        });
      }
      targetInstitute = await Institute.findById(institute);
      if (!targetInstitute) {
        return res.status(400).json({
          success: false,
          message: "Selected institute not found",
        });
      }
      if (targetInstitute.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Cannot assign Placement Officer to inactive institute '${targetInstitute.name}'`,
        });
      }
      instituteId = targetInstitute._id;
    }

    // Generate or validate temporary credentials
    let tempPassword = password;
    if (!tempPassword || String(tempPassword).trim().length === 0) {
      const randomHex = crypto.randomBytes(4).toString("hex");
      tempPassword = `Campus#${randomHex.charAt(0).toUpperCase()}${randomHex.slice(1)}9`;
    } else if (String(tempPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password for privileged users must be at least 8 characters long",
      });
    }

    const isPlacementOfficer = normalizedRole === ROLES.PLACEMENT_OFFICER;

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: tempPassword,
      role: normalizedRole,
      institute: instituteId,
      designation: designation ? String(designation).trim() : (isPlacementOfficer ? "Placement Officer" : ""),
      phone: phone ? String(phone).trim() : "",
      mustChangePassword: isPlacementOfficer,
      invitedBy: req.user._id,
      isActive: true,
    });

    await AdminAuditLog.create({
      action: "create_privileged_user",
      performedBy: req.user._id,
      targetUser: user._id,
      targetInstitute: instituteId,
      details: {
        role: user.role,
        email: user.email,
        institute: instituteId,
        mustChangePassword: user.mustChangePassword,
      },
    });

    res.status(201).json({
      success: true,
      message: `${normalizedRole === ROLES.SUPER_ADMIN ? "Super Admin" : "Placement Officer"} created successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          designation: user.designation,
          phone: user.phone,
          isActive: user.isActive,
          institute: user.institute,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt,
        },
        temporaryPassword: tempPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Reissue credentials / generate new temporary password for privileged account
 * @route  POST /api/admin/users/:id/reissue-credentials
 * @access Admin only
 */
const reissueOfficerCredentials = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    const randomHex = crypto.randomBytes(4).toString("hex");
    const newTempPassword = `Campus#${randomHex.charAt(0).toUpperCase()}${randomHex.slice(1)}9`;

    user.password = newTempPassword;
    user.mustChangePassword = true;
    await user.save();

    await AdminAuditLog.create({
      action: "credential_reissue",
      performedBy: req.user._id,
      targetUser: user._id,
      targetInstitute: user.institute || null,
      details: {
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).json({
      success: true,
      message: `New temporary credentials generated for '${user.email}'`,
      data: {
        userId: user._id,
        email: user.email,
        temporaryPassword: newTempPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   List all registered institutes
 * @route  GET /api/admin/institutes
 * @access Admin only
 */
const listInstitutes = async (req, res, next) => {
  try {
    const institutes = await Institute.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const institutesWithCounts = await Promise.all(
      institutes.map(async (inst) => {
        const [studentCount, officerCount] = await Promise.all([
          User.countDocuments({ institute: inst._id, role: { $in: [ROLES.STUDENT, "student"] } }),
          User.countDocuments({ institute: inst._id, role: { $in: [ROLES.PLACEMENT_OFFICER, "placement_officer"] } }),
        ]);
        return {
          ...inst,
          stats: {
            students: studentCount,
            officers: officerCount,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: institutesWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Register a new institute / college campus
 * @route  POST /api/admin/institutes
 * @access Admin only
 */
const createInstitute = async (req, res, next) => {
  try {
    const { name, code, domain, city, state, contactEmail, contactPhone, website } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Institute name and unique code are required",
      });
    }

    const trimmedName = String(name).trim();
    const formattedCode = String(code).trim().toUpperCase();

    const existing = await Institute.findOne({
      $or: [{ code: formattedCode }, { name: trimmedName }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          existing.code === formattedCode
            ? `An institute with code '${formattedCode}' already exists.`
            : `An institute named '${trimmedName}' already exists.`,
      });
    }

    const institute = await Institute.create({
      name: trimmedName,
      code: formattedCode,
      domain: domain ? String(domain).trim().toLowerCase() : "",
      city: city ? String(city).trim() : "",
      state: state ? String(state).trim() : "",
      contactEmail: contactEmail ? String(contactEmail).trim().toLowerCase() : "",
      contactPhone: contactPhone ? String(contactPhone).trim() : "",
      website: website ? String(website).trim() : "",
      status: "active",
      createdBy: req.user._id,
    });

    await AdminAuditLog.create({
      action: "institute_created",
      performedBy: req.user._id,
      targetInstitute: institute._id,
      details: {
        name: institute.name,
        code: institute.code,
      },
    });

    res.status(201).json({
      success: true,
      message: `Institute '${institute.name}' (${institute.code}) registered successfully`,
      data: institute,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update institute status (active / inactive)
 * @route  PUT /api/admin/institutes/:id/status
 * @access Admin only
 */
const updateInstituteStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'inactive'",
      });
    }

    const institute = await Institute.findById(id);
    if (!institute) {
      return res.status(404).json({
        success: false,
        message: "Institute not found",
      });
    }

    const previousStatus = institute.status;
    institute.status = status;
    await institute.save();

    await AdminAuditLog.create({
      action: "institute_status_change",
      performedBy: req.user._id,
      targetInstitute: institute._id,
      details: {
        previousStatus,
        newStatus: status,
      },
    });

    res.status(200).json({
      success: true,
      message: `Institute '${institute.name}' is now ${status}`,
      data: institute,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get institute by ID with detailed statistics
 * @route  GET /api/admin/institutes/:id
 * @access Admin only
 */
const getInstituteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institute = await Institute.findById(id).populate("createdBy", "name email");

    if (!institute) {
      return res.status(404).json({
        success: false,
        message: "Institute not found",
      });
    }

    const [studentCount, officerCount] = await Promise.all([
      User.countDocuments({ institute: institute._id, role: { $in: [ROLES.STUDENT, "student"] } }),
      User.countDocuments({ institute: institute._id, role: { $in: [ROLES.PLACEMENT_OFFICER, "placement_officer"] } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...institute.toObject(),
        stats: {
          students: studentCount,
          officers: officerCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update institute details
 * @route  PUT /api/admin/institutes/:id
 * @access Admin only
 */
const updateInstitute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, domain, city, state, contactEmail, contactPhone, website } = req.body;

    const institute = await Institute.findById(id);
    if (!institute) {
      return res.status(404).json({
        success: false,
        message: "Institute not found",
      });
    }

    // Check code/name conflicts if updated
    if (code && code.trim().toUpperCase() !== institute.code) {
      const formattedCode = code.trim().toUpperCase();
      const existing = await Institute.findOne({ code: formattedCode, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An institute with code '${formattedCode}' already exists.`,
        });
      }
      institute.code = formattedCode;
    }

    if (name && name.trim() !== institute.name) {
      const trimmedName = name.trim();
      const existing = await Institute.findOne({ name: trimmedName, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An institute named '${trimmedName}' already exists.`,
        });
      }
      institute.name = trimmedName;
    }

    if (domain !== undefined) institute.domain = String(domain).trim().toLowerCase();
    if (city !== undefined) institute.city = String(city).trim();
    if (state !== undefined) institute.state = String(state).trim();
    if (contactEmail !== undefined) institute.contactEmail = String(contactEmail).trim().toLowerCase();
    if (contactPhone !== undefined) institute.contactPhone = String(contactPhone).trim();
    if (website !== undefined) institute.website = String(website).trim();

    await institute.save();

    await AdminAuditLog.create({
      action: "institute_updated",
      performedBy: req.user._id,
      targetInstitute: institute._id,
      details: {
        name: institute.name,
        code: institute.code,
      },
    });

    res.status(200).json({
      success: true,
      message: `Institute '${institute.name}' updated successfully`,
      data: institute,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete an institute safely (strictly blocked if ANY dependent records exist)
 * @route  DELETE /api/admin/institutes/:id
 * @access Admin only
 */
const deleteInstitute = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institute identifier provided",
      });
    }

    const institute = await Institute.findById(id);
    if (!institute) {
      return res.status(404).json({
        success: false,
        message: "Institute not found",
      });
    }

    // 1. User records associated with the institute (students, placement officers, etc.)
    const userCount = await User.countDocuments({ institute: id });
    const instituteUserIds = await User.find({ institute: id }).distinct("_id");

    // 2. StudentProfile records associated directly or via institute students
    const profileCount = await StudentProfile.countDocuments({
      $or: [
        { institute: id },
        ...(instituteUserIds.length > 0 ? [{ user: { $in: instituteUserIds } }] : []),
      ],
    });
    const instituteProfileIds = await StudentProfile.find({
      $or: [
        { institute: id },
        ...(instituteUserIds.length > 0 ? [{ user: { $in: instituteUserIds } }] : []),
      ],
    }).distinct("_id");

    // 3. Jobs associated with the institute directly or posted by institute users
    const jobCount = await Job.countDocuments({
      $or: [
        { institute: id },
        ...(instituteUserIds.length > 0 ? [{ postedBy: { $in: instituteUserIds } }] : []),
      ],
    });
    const instituteJobIds = await Job.find({
      $or: [
        { institute: id },
        ...(instituteUserIds.length > 0 ? [{ postedBy: { $in: instituteUserIds } }] : []),
      ],
    }).distinct("_id");

    // 4. Applications associated with its students, student profiles, or jobs
    const applicationCount = await Application.countDocuments({
      $or: [
        { institute: id },
        ...(instituteUserIds.length > 0 ? [{ student: { $in: instituteUserIds } }] : []),
        ...(instituteProfileIds.length > 0 ? [{ studentProfile: { $in: instituteProfileIds } }] : []),
        ...(instituteJobIds.length > 0 ? [{ job: { $in: instituteJobIds } }] : []),
      ],
    });

    // 5. Companies whose authorizedInstitutes array contains the institute ID
    const companyCount = await Company.countDocuments({
      authorizedInstitutes: id,
    });

    // 6. ResumeAnalysis records associated with institute students or profiles
    const resumeAnalysisCount = (instituteUserIds.length > 0 || instituteProfileIds.length > 0)
      ? await ResumeAnalysis.countDocuments({
          $or: [
            ...(instituteUserIds.length > 0 ? [{ user: { $in: instituteUserIds } }] : []),
            ...(instituteProfileIds.length > 0 ? [{ studentProfile: { $in: instituteProfileIds } }] : []),
          ],
        })
      : 0;

    // Compile dependency details
    const dependencies = [];
    if (userCount > 0) dependencies.push(`${userCount} user account(s)`);
    if (profileCount > 0) dependencies.push(`${profileCount} student profile(s)`);
    if (jobCount > 0) dependencies.push(`${jobCount} job posting(s)`);
    if (applicationCount > 0) dependencies.push(`${applicationCount} application(s)`);
    if (companyCount > 0) dependencies.push(`${companyCount} authorized company/companies`);
    if (resumeAnalysisCount > 0) dependencies.push(`${resumeAnalysisCount} resume analysis record(s)`);

    // If any dependent records exist, return HTTP 409 Conflict and recommend deactivation
    if (dependencies.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete institute '${institute.name}': dependent records exist (${dependencies.join(", ")}). Deactivation is recommended instead of deletion to preserve historical data integrity.`,
        dependencies: {
          users: userCount,
          studentProfiles: profileCount,
          jobs: jobCount,
          applications: applicationCount,
          companies: companyCount,
          resumeAnalyses: resumeAnalysisCount,
        },
      });
    }

    // Zero dependencies confirmed — safe to delete
    await Institute.findByIdAndDelete(id);

    await AdminAuditLog.create({
      action: "institute_deleted",
      performedBy: req.user._id,
      targetInstitute: institute._id,
      details: {
        name: institute.name,
        code: institute.code,
      },
    });

    res.status(200).json({
      success: true,
      message: `Institute '${institute.name}' deleted successfully`,
      data: {
        id: institute._id,
        name: institute.name,
        code: institute.code,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   List companies for Super Admin with search and status filters
 * @route  GET /api/admin/companies
 * @access Admin only
 */
const listCompaniesAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitRaw = parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(Math.max(1, limitRaw), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { industry: searchRegex }, { location: searchRegex }];
    }
    if (req.query.isVerified === "true" || req.query.isVerified === "false") {
      filter.isVerified = req.query.isVerified === "true";
    }
    if (req.query.isActive === "true" || req.query.isActive === "false") {
      filter.isActive = req.query.isActive === "true";
    }

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .populate("createdBy", "name email")
        .populate("verifiedBy", "name email")
        .populate("authorizedInstitutes", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(filter),
    ]);

    const companiesWithStats = await Promise.all(
      companies.map(async (c) => {
        const [jobCount, recruiterCount] = await Promise.all([
          Job.countDocuments({ company: c._id }),
          User.countDocuments({ company: c._id, role: { $in: [ROLES.RECRUITER, "recruiter"] } }),
        ]);
        return {
          ...c,
          stats: {
            jobs: jobCount,
            recruiters: recruiterCount,
            authorizedInstitutes: c.authorizedInstitutes ? c.authorizedInstitutes.length : 0,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        companies: companiesWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Create a company profile via Super Admin
 * @route  POST /api/admin/companies
 * @access Admin only
 */
const createCompanyAdmin = async (req, res, next) => {
  try {
    const { name, description, website, location, industry, isVerified } = req.body;
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    const trimmedName = String(name).trim();
    const existing = await Company.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, "i") } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A company named '${trimmedName}' already exists.`,
      });
    }

    const shouldVerify = isVerified === true;

    const company = await Company.create({
      name: trimmedName,
      description: description ? String(description).trim() : "",
      website: website ? String(website).trim() : "",
      location: location ? String(location).trim() : "",
      industry: industry ? String(industry).trim() : "Technology",
      createdBy: req.user._id,
      isVerified: shouldVerify,
      verifiedBy: shouldVerify ? req.user._id : null,
      verifiedAt: shouldVerify ? new Date() : null,
      isActive: true,
      authorizedInstitutes: [],
    });

    await AdminAuditLog.create({
      action: "company_created",
      performedBy: req.user._id,
      targetCompany: company._id,
      details: {
        name: company.name,
        isVerified: company.isVerified,
      },
    });

    res.status(201).json({
      success: true,
      message: `Company '${company.name}' created successfully`,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get single company details for Super Admin
 * @route  GET /api/admin/companies/:id
 * @access Admin only
 */
const getCompanyByIdAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
    }

    const company = await Company.findById(id)
      .populate("createdBy", "name email")
      .populate("verifiedBy", "name email")
      .populate("authorizedInstitutes", "name code city state status");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const [jobCount, recruiterCount] = await Promise.all([
      Job.countDocuments({ company: company._id }),
      User.countDocuments({ company: company._id, role: { $in: [ROLES.RECRUITER, "recruiter"] } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...company.toObject(),
        stats: {
          jobs: jobCount,
          recruiters: recruiterCount,
          authorizedInstitutes: company.authorizedInstitutes ? company.authorizedInstitutes.length : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update company details via Super Admin
 * @route  PUT /api/admin/companies/:id
 * @access Admin only
 */
const updateCompanyAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, website, location, industry } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (name && String(name).trim() !== company.name) {
      const trimmedName = String(name).trim();
      const existing = await Company.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `A company named '${trimmedName}' already exists.`,
        });
      }
      company.name = trimmedName;
    }

    if (description !== undefined) company.description = String(description).trim();
    if (website !== undefined) company.website = String(website).trim();
    if (location !== undefined) company.location = String(location).trim();
    if (industry !== undefined) company.industry = String(industry).trim();

    await company.save();

    await AdminAuditLog.create({
      action: "company_updated",
      performedBy: req.user._id,
      targetCompany: company._id,
      details: { name: company.name },
    });

    res.status(200).json({
      success: true,
      message: `Company '${company.name}' updated successfully`,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Verify or revoke verification of a company (Super Admin platform control)
 * @route  PUT /api/admin/companies/:id/verify
 * @access Admin only
 */
const verifyCompanyAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    if (typeof isVerified !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Request body must contain { isVerified: boolean }",
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isVerified = isVerified;
    company.verifiedBy = req.user._id;
    company.verifiedAt = isVerified ? new Date() : null;
    await company.save();

    // If verification revoked, close all open jobs from public discovery
    if (!isVerified) {
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
        isVerified,
      },
    });

    res.status(200).json({
      success: true,
      message: isVerified
        ? `Company '${company.name}' verified successfully`
        : `Verification revoked for '${company.name}'. Open jobs closed.`,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Toggle company active / inactive status
 * @route  PUT /api/admin/companies/:id/status
 * @access Admin only
 */
const updateCompanyStatusAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Request body must contain { isActive: boolean }",
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isActive = isActive;
    await company.save();

    if (!isActive) {
      await Job.updateMany(
        { company: company._id, status: "open" },
        { $set: { status: "closed" } }
      );
    }

    await AdminAuditLog.create({
      action: "company_status_change",
      performedBy: req.user._id,
      targetCompany: company._id,
      details: {
        companyName: company.name,
        isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: `Company '${company.name}' is now ${isActive ? "active" : "inactive"}`,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Provision a Recruiter account (Super Admin platform-wide creation)
 * @route  POST /api/admin/recruiters
 * @access Admin only
 */
const provisionRecruiterAdmin = async (req, res, next) => {
  try {
    const { name, email, password, companyId, designation, phone } = req.body;

    if (!name || !email || !companyId) {
      return res.status(400).json({
        success: false,
        message: "Please provide recruiter name, email, and company",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    const targetCompany = await Company.findById(companyId);
    if (!targetCompany) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (!targetCompany.isActive) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign recruiter to inactive company '${targetCompany.name}'`,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    // Generate temporary password if not provided
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
      company: targetCompany._id,
      institute: null,
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
      targetCompany: targetCompany._id,
      details: {
        email: recruiter.email,
        companyName: targetCompany.name,
        provisionedByRole: req.user.role,
      },
    });

    res.status(201).json({
      success: true,
      message: `Recruiter '${recruiter.name}' provisioned for '${targetCompany.name}'`,
      data: {
        user: {
          id: recruiter._id,
          name: recruiter.name,
          email: recruiter.email,
          role: recruiter.role,
          company: targetCompany._id,
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
    next(error);
  }
};

/**
 * @desc   Authorize a verified company for a specified institute (Super Admin platform control)
 * @route  POST /api/admin/companies/:id/authorize
 * @access Admin only
 */
const authorizeCompanyAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const instituteId = req.params?.instituteId || req.body?.instituteId || req.query?.instituteId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }
    if (!instituteId || !mongoose.Types.ObjectId.isValid(instituteId)) {
      return res.status(400).json({ success: false, message: "A valid instituteId is required" });
    }

    const [company, institute] = await Promise.all([
      Company.findById(id),
      Institute.findById(instituteId),
    ]);

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!institute) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    if (!company.isActive) {
      return res.status(400).json({
        success: false,
        message: `Cannot authorize inactive company '${company.name}'.`,
      });
    }

    if (!company.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Only platform-verified companies can be authorized for campus placements.",
      });
    }

    if (institute.status !== "active") {
      return res.status(400).json({
        success: false,
        message: `Cannot authorize company for inactive institute '${institute.name}'.`,
      });
    }

    const alreadyAuthorized = company.authorizedInstitutes?.some(
      (inst) => String(inst) === String(institute._id)
    );
    if (alreadyAuthorized) {
      return res.status(400).json({
        success: false,
        message: `Company '${company.name}' is already authorized for ${institute.name}.`,
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
        instituteName: institute.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Revoke authorization of a company for a specified institute (Super Admin platform control)
 * @route  DELETE /api/admin/companies/:id/authorize
 * @access Admin only
 */
const revokeCompanyAuthorizationAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const instituteId = req.params?.instituteId || req.body?.instituteId || req.query?.instituteId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }
    if (!instituteId || !mongoose.Types.ObjectId.isValid(instituteId)) {
      return res.status(400).json({ success: false, message: "A valid instituteId is required" });
    }

    const [company, institute] = await Promise.all([
      Company.findById(id),
      Institute.findById(instituteId),
    ]);

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    if (!institute) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    const isAuthorized = company.authorizedInstitutes?.some(
      (inst) => String(inst) === String(institute._id)
    );
    if (!isAuthorized) {
      return res.status(400).json({
        success: false,
        message: `Company '${company.name}' is not currently authorized for ${institute.name}.`,
      });
    }

    company.authorizedInstitutes = company.authorizedInstitutes.filter(
      (inst) => String(inst) !== String(institute._id)
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
        revokedByRole: req.user.role,
      },
    });

    res.status(200).json({
      success: true,
      message: `Placement authorization for '${company.name}' revoked for ${institute.name}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserRole,
  getAdminOverview,
  createPrivilegedUser,
  reissueOfficerCredentials,
  listInstitutes,
  getInstituteById,
  createInstitute,
  updateInstitute,
  updateInstituteStatus,
  deleteInstitute,
  listCompaniesAdmin,
  createCompanyAdmin,
  getCompanyByIdAdmin,
  updateCompanyAdmin,
  verifyCompanyAdmin,
  updateCompanyStatusAdmin,
  provisionRecruiterAdmin,
  authorizeCompanyAdmin,
  revokeCompanyAuthorizationAdmin,
};
