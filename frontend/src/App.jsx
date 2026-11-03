import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageLoader } from "./components/Loader";

// Eager: tiny shared chrome only
// Lazy: page-level routes to split the production bundle
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminSecurityGatewayPage = lazy(() => import("./pages/admin/AdminSecurityGatewayPage"));

// Dedicated Standardized Auth Pages
const StudentLoginPage = lazy(() => import("./pages/student/StudentLoginPage"));
const StudentRegisterPage = lazy(() => import("./pages/student/StudentRegisterPage"));
const OfficerLoginPage = lazy(() => import("./pages/officer/OfficerLoginPage"));
const RecruiterLoginPage = lazy(() => import("./pages/recruiter/RecruiterLoginPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const ProfilePage = lazy(() => import("./pages/student/ProfilePage"));
const ResumeUploadPage = lazy(() => import("./pages/student/ResumeUploadPage"));
const ResumeTemplatesPage = lazy(() => import("./pages/student/ResumeTemplatesPage"));
const ResumeBuilderPage = lazy(() => import("./pages/student/ResumeBuilderPage"));
const RecommendationsPage = lazy(() => import("./pages/student/RecommendationsPage"));
const JobSearchPage = lazy(() => import("./pages/student/JobSearchPage"));
const ApplicationsPage = lazy(() => import("./pages/student/ApplicationsPage"));

const RecruiterDashboard = lazy(() => import("./pages/recruiter/RecruiterDashboard"));
const PostJobPage = lazy(() => import("./pages/recruiter/PostJobPage"));
const ApplicantManagementPage = lazy(() => import("./pages/recruiter/ApplicantManagementPage"));
const ApplicantReviewPage = lazy(() => import("./pages/recruiter/ApplicantReviewPage"));

const OfficerDashboard = lazy(() => import("./pages/officer/OfficerDashboard"));
const StudentDirectoryPage = lazy(() => import("./pages/officer/StudentDirectoryPage"));
const RecruitmentMonitorPage = lazy(() => import("./pages/officer/RecruitmentMonitorPage"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-paper text-ink font-body">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes — student-facing only in navigation */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/register" element={<Navigate to="/student/register" replace />} />
                <Route path="/login" element={<Navigate to="/student/login" replace />} />

                {/* 1. Student Authentication */}
                <Route path="/student/login" element={<StudentLoginPage />} />
                <Route path="/student/register" element={<StudentRegisterPage />} />

                {/* 2. Recruiter Authentication (Public recruiter registration disabled) */}
                <Route path="/recruiter/login" element={<RecruiterLoginPage />} />
                <Route path="/recruiter/register" element={<Navigate to="/recruiter/login" replace />} />

                {/* 3. Placement Officer Authentication */}
                <Route path="/officer/login" element={<OfficerLoginPage />} />
                <Route path="/placement-officer/login" element={<OfficerLoginPage />} />

                {/* 4. Super Admin Authentication (Protected Security Gateway) */}
                <Route path="/super-admin/login" element={<AdminSecurityGatewayPage />} />
                <Route path="/admin/security-gateway" element={<AdminSecurityGatewayPage />} />
                <Route path="/admin-portal/security-gateway" element={<AdminSecurityGatewayPage />} />
                <Route path="/admin/login" element={<Navigate to="/super-admin/login" replace />} />

                {/* First-login mandatory password change */}
                <Route
                  path="/change-password"
                  element={
                    <ProtectedRoute>
                      <ChangePasswordPage />
                    </ProtectedRoute>
                  }
                />

                {/* Student Routes */}
                <Route
                  path="/student/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/profile"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/resume"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <ResumeUploadPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/resume-builder"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <ResumeTemplatesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/resume-builder/:templateId"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <ResumeBuilderPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/recommendations"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <RecommendationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/jobs"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <JobSearchPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/applications"
                  element={
                    <ProtectedRoute allowedRoles={["student"]}>
                      <ApplicationsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Recruiter Routes */}
                <Route
                  path="/recruiter/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter"]}>
                      <RecruiterDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/post-job"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter"]}>
                      <PostJobPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/create"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter"]}>
                      <PostJobPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/:jobId/edit"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter"]}>
                      <PostJobPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/:jobId/applicants"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter", "placement_officer", "admin"]}>
                      <ApplicantManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/:jobId/candidates"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter", "placement_officer", "admin"]}>
                      <ApplicantManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/:jobId/applicants/:applicationId/review"
                  element={
                    <ProtectedRoute allowedRoles={["recruiter", "placement_officer", "admin"]}>
                      <ApplicantReviewPage />
                    </ProtectedRoute>
                  }
                />

                {/* Placement Officer & Admin Routes (canonical + legacy aliases) */}
                <Route
                  path="/placement-officer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["placement_officer", "admin"]}>
                      <OfficerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/placement-officer/students"
                  element={
                    <ProtectedRoute allowedRoles={["placement_officer", "admin"]}>
                      <StudentDirectoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/placement-officer/recruitment"
                  element={
                    <ProtectedRoute allowedRoles={["placement_officer", "admin"]}>
                      <RecruitmentMonitorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/officer/dashboard"
                  element={<Navigate to="/placement-officer/dashboard" replace />}
                />
                <Route
                  path="/officer/students"
                  element={<Navigate to="/placement-officer/students" replace />}
                />
                <Route
                  path="/officer/recruitment"
                  element={<Navigate to="/placement-officer/recruitment" replace />}
                />

                {/* Administrator Console */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
          <footer className="border-t border-sage py-6 bg-surface text-center text-xs text-ink-muted">
            CampusPlacement · AI-Powered Campus Placement Intelligence · Local Open-Source Architecture
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
