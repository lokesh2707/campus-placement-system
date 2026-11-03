const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { normalizeRole } = require("../constants/roles");

/**
 * Protect routes: verifies user is authenticated.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check HTTP-only cookie first
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fall back to Authorization Bearer header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route. Please log in.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User belonging to this token no longer exists.",
      });
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact an administrator.",
      });
    }

    // First-login password change restriction
    if (req.user.mustChangePassword) {
      const allowedPaths = [
        "/api/auth/change-password",
        "/api/auth/logout",
        "/api/auth/me",
      ];
      const targetUrl = req.originalUrl || req.baseUrl + req.path;
      const isAllowed = allowedPaths.some((p) => targetUrl.startsWith(p));

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          mustChangePassword: true,
          message:
            "Password change required. You must change your temporary password before accessing platform features.",
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Session invalid or expired. Please log in again.",
    });
  }
};

/**
 * Grant access to specific roles only.
 * Normalizes both allowed roles and req.user.role to ensure safe backward
 * compatibility between legacy ("admin", "placement_officer", "recruiter", "student")
 * and standardized ("SUPER_ADMIN", "PLACEMENT_OFFICER", "RECRUITER", "STUDENT") roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "User role 'unknown' is not authorized to access this resource",
      });
    }

    const normalizedUserRole = normalizeRole(req.user.role);
    const normalizedAllowed = roles.map((r) => normalizeRole(r));

    if (!normalizedAllowed.includes(normalizedUserRole)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

/**
 * Optional authentication: attaches req.user when a valid token is present,
 * but does not reject anonymous requests. Used for public job discovery that
 * still benefits from knowing the caller's role (e.g. recruiter own-jobs).
 */
const optionalProtect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user && user.isActive) {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }

  next();
};

module.exports = { protect, authorize, optionalProtect };
