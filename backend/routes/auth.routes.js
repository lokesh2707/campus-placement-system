const express = require("express");
const {
  getActiveInstitutes,
  register,
  studentRegister,
  recruiterRegister,
  login,
  adminSecureLogin,
  changePassword,
  logout,
  getMe,
} = require("../controllers/auth.controller");
const { protect, authorize } = require("../middleware/auth");
const { createAuthRateLimiter } = require("../middleware/rateLimit");
const { ROLES } = require("../constants/roles");

const router = express.Router();

// Rate-limiters for authentication
const authRateLimiter = createAuthRateLimiter();
const adminAuthRateLimiter = createAuthRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
});

// Public registration & discovery
router.get("/institutes", getActiveInstitutes);
router.post("/student/register", authRateLimiter, studentRegister);
router.post("/register", authRateLimiter, register);
router.post("/recruiter/register", recruiterRegister); // Explicitly disabled

// Standardized login endpoints
router.post("/login", authRateLimiter, login);
router.post("/super-admin/login", adminAuthRateLimiter, adminSecureLogin);
router.post(
  "/admin/secure-gateway-login",
  adminAuthRateLimiter,
  adminSecureLogin
); // Alias for security gateway
router.post("/logout", logout);

// Protected account management
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);

// Role verification check route
router.get(
  "/officer-check",
  protect,
  authorize(ROLES.PLACEMENT_OFFICER, ROLES.SUPER_ADMIN),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: `Authorized as ${req.user.role}. Access granted to officer portal.`,
    });
  }
);

module.exports = router;
