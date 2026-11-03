import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Briefcase,
  FileText,
  Sparkles,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
  User,
  PlusCircle,
  ClipboardList,
  Shield,
} from "lucide-react";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/student/login");
  };

  const ROLE_MAP = {
    admin: "SUPER_ADMIN",
    placement_officer: "PLACEMENT_OFFICER",
    recruiter: "RECRUITER",
    student: "STUDENT",
    SUPER_ADMIN: "SUPER_ADMIN",
    PLACEMENT_OFFICER: "PLACEMENT_OFFICER",
    RECRUITER: "RECRUITER",
    STUDENT: "STUDENT",
  };

  const userRole = user?.role ? ROLE_MAP[user.role] || user.role : null;

  const roleBadgeColors = {
    student: "bg-teal-soft text-teal border-sage",
    STUDENT: "bg-teal-soft text-teal border-sage",
    recruiter: "bg-accent-soft text-ink border-sage",
    RECRUITER: "bg-accent-soft text-ink border-sage",
    placement_officer: "bg-accent-soft text-ink border-sage",
    PLACEMENT_OFFICER: "bg-accent-soft text-ink border-sage",
    admin: "bg-teal-soft text-teal-deep border-sage",
    SUPER_ADMIN: "bg-teal-soft text-teal-deep border-sage",
  };

  const isActive = (path) => location.pathname === path;
  const linkClass = (path) =>
    `nav-link inline-flex items-center gap-1.5 h-9 ${isActive(path) ? "nav-link-active" : ""}`;

  const sectionActive = (hash) => {
    if (location.pathname !== "/") return false;
    const current = location.hash || "#home";
    return current === hash;
  };
  const sectionClass = (hash) =>
    `nav-link inline-flex items-center h-9 ${sectionActive(hash) ? "nav-link-active" : ""}`;

  return (
    <nav className="bg-surface/95 backdrop-blur-sm border-b border-sage sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: brand */}
          <Link to="/" className="flex items-center shrink-0 self-center">
            <img
              src="/brand/campusplacement-logo.png"
              alt="CampusPlacement Intelligence"
              className="h-9 sm:h-10 w-auto object-contain object-left"
              style={{ height: 60, width: 'auto' }}
            />
          </Link>

          {/* Center: navigation */}
          {user ? (
            <div className="hidden md:flex flex-1 items-center justify-start gap-1 ml-2 min-w-0 overflow-x-auto">
              {userRole === "STUDENT" && (
                <>
                  <Link to="/student/dashboard" className={linkClass("/student/dashboard")}>
                    <Briefcase className="w-4 h-4" /> Dashboard
                  </Link>
                  <Link to="/student/profile" className={linkClass("/student/profile")}>
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <Link to="/student/resume" className={linkClass("/student/resume")}>
                    <FileText className="w-4 h-4" /> Resume AI
                  </Link>
                  <Link to="/student/recommendations" className={linkClass("/student/recommendations")}>
                    <Sparkles className="w-4 h-4 text-accent" /> AI Matches
                  </Link>
                  <Link to="/student/jobs" className={linkClass("/student/jobs")}>
                    <Briefcase className="w-4 h-4" /> Browse Jobs
                  </Link>
                  <Link to="/student/applications" className={linkClass("/student/applications")}>
                    <ClipboardList className="w-4 h-4" /> Applications
                  </Link>
                </>
              )}

              {userRole === "RECRUITER" && (
                <>
                  <Link to="/recruiter/dashboard" className={linkClass("/recruiter/dashboard")}>
                    <Briefcase className="w-4 h-4" /> Recruiter Hub
                  </Link>
                  <Link to="/recruiter/jobs/create" className={linkClass("/recruiter/jobs/create")}>
                    <PlusCircle className="w-4 h-4" /> Post a Job
                  </Link>
                </>
              )}

              {(userRole === "PLACEMENT_OFFICER" || userRole === "SUPER_ADMIN") && (
                <>
                  <Link
                    to="/placement-officer/dashboard"
                    className={linkClass("/placement-officer/dashboard")}
                  >
                    <BarChart3 className="w-4 h-4" /> Placement Analytics
                  </Link>
                  <Link
                    to="/placement-officer/students"
                    className={linkClass("/placement-officer/students")}
                  >
                    <Users className="w-4 h-4" /> Student Directory
                  </Link>
                  <Link
                    to="/placement-officer/recruitment"
                    className={linkClass("/placement-officer/recruitment")}
                  >
                    <Briefcase className="w-4 h-4" /> Recruitment
                  </Link>
                </>
              )}

              {userRole === "SUPER_ADMIN" && (
                <Link to="/admin/dashboard" className={linkClass("/admin/dashboard")}>
                  <Shield className="w-4 h-4" /> Admin Console
                </Link>
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center gap-1">
              <Link to="/#home" className={sectionClass("#home")}>
                Home
              </Link>
              <Link to="/about" className={location.pathname === "/about" || sectionActive("#about") ? "nav-link nav-link-active inline-flex items-center h-9" : "nav-link inline-flex items-center h-9"}>
                About
              </Link>
              <a href="/#features" className={sectionClass("#features")}>
                Features
              </a>
            </div>
          )}

          {/* Right: actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <div className="text-right leading-tight">
                  <div className="text-sm font-semibold text-ink">{user.name}</div>
                  <span
                    className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      roleBadgeColors[user.role] || "bg-teal-soft text-teal border-sage"
                    }`}
                  >
                    {user.role.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center h-9 w-9 text-ink-muted hover:text-teal-deep hover:bg-teal-soft rounded-lg transition"
                  title="Log out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/student/login"
                  className="inline-flex items-center h-9 px-3 text-sm font-semibold text-teal hover:bg-teal-soft rounded-lg transition"
                >
                  Student Login
                </Link>
                <Link
                  to="/student/register"
                  className="btn-primary inline-flex items-center justify-center h-9 px-4 text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center md:hidden ml-auto">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center h-9 w-9 text-ink-muted hover:text-ink rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-sage bg-surface px-4 pt-3 pb-5 space-y-1">
          {user ? (
            <>
              <div className="pb-3 border-b border-sage mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink">{user.name}</div>
                  <div className="text-xs text-ink-muted">{user.email}</div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    roleBadgeColors[user.role] || "bg-teal-soft text-teal border-sage"
                  }`}
                >
                  {user.role.toUpperCase()}
                </span>
              </div>

              {userRole === "STUDENT" && (
                <>
                  <Link to="/student/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Dashboard</Link>
                  <Link to="/student/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">My Profile</Link>
                  <Link to="/student/resume" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Resume AI</Link>
                  <Link to="/student/recommendations" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">AI Matches</Link>
                  <Link to="/student/jobs" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Browse Jobs</Link>
                  <Link to="/student/applications" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">My Applications</Link>
                </>
              )}

              {userRole === "RECRUITER" && (
                <>
                  <Link to="/recruiter/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Recruiter Hub</Link>
                  <Link to="/recruiter/jobs/create" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Post a Job</Link>
                </>
              )}

              {(userRole === "PLACEMENT_OFFICER" || userRole === "SUPER_ADMIN") && (
                <>
                  <Link to="/placement-officer/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Placement Analytics</Link>
                  <Link to="/placement-officer/students" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Student Directory</Link>
                  <Link to="/placement-officer/recruitment" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Recruitment</Link>
                </>
              )}

              {userRole === "SUPER_ADMIN" && (
                <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">
                  Admin Console
                </Link>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 h-10 px-4 bg-teal-soft text-teal rounded-lg text-sm font-semibold hover:bg-teal hover:text-white transition"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <div className="space-y-1 pt-1">
              <a href="/#home" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Home</a>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">About</Link>
              <a href="/#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Features</a>
              <Link to="/student/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink hover:bg-teal-soft">Student Login</Link>
              <Link
                to="/student/register"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center h-10 text-sm font-semibold text-white bg-teal rounded-lg hover:bg-teal-deep"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
