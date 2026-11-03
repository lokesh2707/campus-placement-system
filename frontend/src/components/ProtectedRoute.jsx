import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./Loader";

const ROLE_MAP = {
  admin: "SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  placement_officer: "PLACEMENT_OFFICER",
  PLACEMENT_OFFICER: "PLACEMENT_OFFICER",
  recruiter: "RECRUITER",
  RECRUITER: "RECRUITER",
  student: "STUDENT",
  STUDENT: "STUDENT",
};

const normalizeRole = (r) => (r ? ROLE_MAP[r] || r : r);

const ROLE_HOME = {
  student: "/student/dashboard",
  STUDENT: "/student/dashboard",
  recruiter: "/recruiter/dashboard",
  RECRUITER: "/recruiter/dashboard",
  placement_officer: "/placement-officer/dashboard",
  PLACEMENT_OFFICER: "/placement-officer/dashboard",
  admin: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard",
};

function loginPathForRoles(allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return "/student/login";
  const normalized = allowedRoles.map(normalizeRole);
  if (normalized.includes("STUDENT") && normalized.length === 1) {
    return "/student/login";
  }
  if (normalized.includes("RECRUITER") && !normalized.includes("PLACEMENT_OFFICER")) {
    return "/recruiter/login";
  }
  if (normalized.includes("SUPER_ADMIN") && !normalized.includes("PLACEMENT_OFFICER")) {
    return "/super-admin/login";
  }
  if (normalized.includes("PLACEMENT_OFFICER")) {
    return "/officer/login";
  }
  return "/student/login";
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Loading session..." fullScreen />;
  }

  if (!user) {
    return (
      <Navigate
        to={loginPathForRoles(allowedRoles)}
        state={{ from: location }}
        replace
      />
    );
  }

  // Force users with temporary passwords to complete first-login password change
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles) {
    const userRole = normalizeRole(user.role);
    const allowed = allowedRoles.map(normalizeRole);
    if (!allowed.includes(userRole)) {
      const home = ROLE_HOME[user.role] || ROLE_HOME[userRole] || "/";
      return <Navigate to={home} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
