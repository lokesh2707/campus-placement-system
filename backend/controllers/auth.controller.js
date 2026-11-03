const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const Institute = require("../models/Institute");
const AdminAuditLog = require("../models/AdminAuditLog");
const { ROLES, normalizeRole } = require("../constants/roles");

// In-memory brute-force defense tracker for administrator gateway
const adminLoginAttempts = new Map();
const MAX_ADMIN_FAILURES = 5;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const getClientIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

const checkAdminLockout = (key) => {
  const entry = adminLoginAttempts.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    adminLoginAttempts.delete(key);
    return null;
  }
  return null;
};

const recordAdminFailure = (key) => {
  const now = Date.now();
  let entry = adminLoginAttempts.get(key);
  if (!entry || (entry.firstAttempt && now - entry.firstAttempt > ADMIN_LOCKOUT_MS)) {
    entry = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    entry.count += 1;
  }

  if (entry.count >= MAX_ADMIN_FAILURES) {
    entry.lockedUntil = now + ADMIN_LOCKOUT_MS;
  }
  adminLoginAttempts.set(key, entry);
  return entry;
};

const clearAdminFailures = (key) => {
  adminLoginAttempts.delete(key);
};

/**
 * Helper to generate JWT and send response with secure HTTP-only cookie.
 */
const sendTokenResponse = (user, statusCode, res, message) => {
  const normalizedRole = normalizeRole(user.role);
  const token = jwt.sign(
    { id: user._id, role: normalizedRole },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "30d" }
  );

  const days = parseInt(process.env.JWT_COOKIE_EXPIRE || "30", 10);
  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true, // Prevents client-side scripts from reading cookie
    secure: process.env.NODE_ENV === "production", // HTTPS in production
    sameSite: "lax",
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      message,
      token, // Also returned in body for API testing flexibility
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: normalizedRole,
        mustChangePassword: user.mustChangePassword === true,
        institute: user.institute || null,
        company: user.company || null,
      },
    });
};

/**
 * @desc   Get active institutes for student registration dropdown
 * @route  GET /api/auth/institutes
 * @access Public
 */
const getActiveInstitutes = async (req, res, next) => {
  try {
    const institutes = await Institute.find({ status: "active" })
      .select("name code city state domain")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: institutes.length,
      institutes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Register a dedicated student account
 * @route  POST /api/auth/student/register
 * @access Public
 */
const studentRegister = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      rollNumber,
      department,
      batch,
      institute,
      role,
    } = req.body;

    // Security check: reject attempts to self-assign any role other than STUDENT
    if (role && role !== ROLES.STUDENT && role !== "student") {
      return res.status(403).json({
        success: false,
        message:
          "Public registration only creates student accounts. Privileged or recruiter roles cannot be self-assigned.",
      });
    }

    if (!name || !email || !password || !rollNumber || !institute) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide full name, email, password, roll number, and select an active institute.",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRoll = String(rollNumber).trim().toUpperCase();

    // Validate that institute is an active institute
    if (!mongoose.Types.ObjectId.isValid(institute)) {
      return res.status(400).json({
        success: false,
        message: "Invalid institute identifier.",
      });
    }

    const targetInstitute = await Institute.findOne({
      _id: institute,
      status: "active",
    });

    if (!targetInstitute) {
      return res.status(400).json({
        success: false,
        message: "Selected institute is inactive or does not exist.",
      });
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    // Check duplicate roll number
    const existingProfile = await StudentProfile.findOne({
      rollNumber: normalizedRoll,
    });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "A student profile with this roll number already exists.",
      });
    }

    // Always assign STUDENT server-side regardless of client input
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role: ROLES.STUDENT,
      institute: targetInstitute._id,
      isActive: true,
      mustChangePassword: false,
    });

    await StudentProfile.create({
      user: user._id,
      institute: targetInstitute._id,
      rollNumber: normalizedRoll,
      department: department
        ? String(department).trim()
        : "Computer Science and Engineering",
      batch: batch ? parseInt(batch, 10) : new Date().getFullYear() + 1,
      cgpa: 0.0,
    });

    // Return populated institute so profile pages can show the registered college name
    await user.populate("institute", "name code city state");

    sendTokenResponse(user, 201, res, "Student registered successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Register alias for public registration (strictly students)
 * @route  POST /api/auth/register
 * @access Public
 */
const register = (req, res, next) => {
  return studentRegister(req, res, next);
};

/**
 * @desc   Public recruiter registration (Disabled in Phase 3)
 * @route  POST /api/auth/recruiter/register
 * @access Disabled
 */
const recruiterRegister = (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "Public recruiter registration is disabled. Recruiter accounts must be provisioned by an authorized Placement Officer.",
  });
};

/**
 * @desc   Login user (Student, Recruiter, Placement Officer)
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password, expectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact an administrator.",
      });
    }

    const normalizedUserRole = normalizeRole(user.role);

    // Super Admin is strictly barred from the generic login endpoint to defeat brute-force probes
    if (normalizedUserRole === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message:
          "Administrator authentication is restricted to the Super Admin login security gateway.",
      });
    }

    // Role separation guard: enforce appropriate portal entry when expectedRole is provided
    if (expectedRole) {
      const normalizedExpected = normalizeRole(expectedRole);
      if (normalizedUserRole !== normalizedExpected) {
        const portalNames = {
          [ROLES.STUDENT]: "Student Portal (/student/login)",
          [ROLES.RECRUITER]: "Recruiter Portal (/recruiter/login)",
          [ROLES.PLACEMENT_OFFICER]: "Placement Officer Portal (/officer/login)",
        };
        const correctPortal = portalNames[normalizedUserRole] || "the main login page";
        return res.status(403).json({
          success: false,
          message: `This account is registered as a '${normalizedUserRole.replace(/_/g, " ")}'. Please sign in through ${correctPortal}.`,
          userRole: normalizedUserRole,
        });
      }
    }

    await user.populate([
      { path: "institute", select: "name code city state" },
      { path: "company", select: "name isVerified" },
    ]);

    sendTokenResponse(user, 200, res, "Logged in successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Dedicated, rate-limited and brute-force protected Super Admin Gateway Login
 * @route  POST /api/auth/super-admin/login or /api/auth/admin/secure-gateway-login
 * @access Restricted / Super Admin Only
 */
const adminSecureLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientIp = getClientIp(req);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const lockoutKey = `${clientIp}_${normalizedEmail}`;

    // 1. Check if IP or Account is currently in brute-force lockout
    const ipLock = checkAdminLockout(clientIp);
    const accountLock = checkAdminLockout(lockoutKey);
    const activeLock = ipLock || accountLock;

    if (activeLock && activeLock.locked) {
      return res.status(429).json({
        success: false,
        message: `Administrative security lockout engaged due to repeated failed attempts. Please retry in ${activeLock.remainingSeconds} seconds.`,
        remainingSeconds: activeLock.remainingSeconds,
      });
    }

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide administrator email and password",
      });
    }

    // 2. Query user with explicit select for password
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    // 3. Strict verification: must exist, must match password, and MUST be Super Admin
    if (!user || normalizeRole(user.role) !== ROLES.SUPER_ADMIN) {
      const entry = recordAdminFailure(clientIp);
      recordAdminFailure(lockoutKey);
      const attemptsRemaining = Math.max(0, MAX_ADMIN_FAILURES - entry.count);

      if (entry.count >= MAX_ADMIN_FAILURES) {
        await AdminAuditLog.create({
          action: "admin_security_alert",
          performedBy: new mongoose.Types.ObjectId("000000000000000000000000"),
          details: {
            ip: clientIp,
            email: normalizedEmail,
            reason: "Excessive failed administrator authentication attempts triggered IP lockout.",
          },
        }).catch(() => {});

        return res.status(429).json({
          success: false,
          message:
            "Maximum administrator authentication attempts exceeded. Gateway locked for 15 minutes.",
          remainingSeconds: ADMIN_LOCKOUT_MS / 1000,
        });
      }

      return res.status(401).json({
        success: false,
        message: `Invalid administrator credentials. (${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before lockout)`,
        attemptsRemaining,
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const entry = recordAdminFailure(clientIp);
      recordAdminFailure(lockoutKey);
      const attemptsRemaining = Math.max(0, MAX_ADMIN_FAILURES - entry.count);

      if (entry.count >= MAX_ADMIN_FAILURES) {
        await AdminAuditLog.create({
          action: "admin_security_alert",
          performedBy: user._id,
          targetUser: user._id,
          details: {
            ip: clientIp,
            email: normalizedEmail,
            reason: "Failed password attempts triggered 15-minute administrative lockout.",
          },
        }).catch(() => {});

        return res.status(429).json({
          success: false,
          message: "Maximum login attempts exceeded. Administrative gateway locked for 15 minutes.",
          remainingSeconds: ADMIN_LOCKOUT_MS / 1000,
        });
      }

      return res.status(401).json({
        success: false,
        message: `Invalid administrator credentials. (${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before lockout)`,
        attemptsRemaining,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This administrator account has been deactivated.",
      });
    }

    // 4. Successful login: Clear failed attempt tracking for IP and account
    clearAdminFailures(clientIp);
    clearAdminFailures(lockoutKey);

    sendTokenResponse(user, 200, res, "Administrator authentication verified successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Change user password (supports first-login mandatory password change)
 * @route  POST /api/auth/change-password
 * @access Protected
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide a new password",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // If currentPassword is provided, verify it matches
    if (currentPassword) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password does not match",
        });
      }
    }

    // Prevent reusing the exact same password
    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as your current password",
      });
    }

    user.password = newPassword; // Will be hashed by UserSchema pre-save hook
    user.mustChangePassword = false;
    await user.save();

    // Rotate session token
    sendTokenResponse(
      user,
      200,
      res,
      "Password updated successfully. Full account access unlocked."
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Log out user & clear cookie
 * @route  POST /api/auth/logout
 * @access Public
 */
const logout = (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 5 * 1000), // expires in 5 seconds
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

/**
 * @desc   Get currently logged-in user profile
 * @route  GET /api/auth/me
 * @access Protected
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("institute", "name code city state")
      .populate("company", "name isVerified");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const normalizedRole = normalizeRole(user.role);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: normalizedRole,
        mustChangePassword: user.mustChangePassword === true,
        institute: user.institute || null,
        company: user.company || null,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveInstitutes,
  register,
  studentRegister,
  recruiterRegister,
  login,
  adminSecureLogin,
  changePassword,
  logout,
  getMe,
};
