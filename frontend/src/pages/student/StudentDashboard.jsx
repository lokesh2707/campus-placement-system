import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FileText,
  Sparkles,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  X,
  User,
  GraduationCap,
  Code,
  FolderGit2,
  Download,
  Trash2,
  Upload,
  Building,
  CheckCircle2,
} from "lucide-react";
import { DashboardSkeleton, ButtonSpinner } from "../../components/Loader";

const StudentDashboard = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flashMsg, setFlashMsg] = useState(location.state?.message || null);
  const [resumeActionMsg, setResumeActionMsg] = useState("");
  const [deletingResume, setDeletingResume] = useState(false);
  const [generatedResumes, setGeneratedResumes] = useState([]);

  const fetchProfileAndData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const profRes = await fetch("/api/students/profile/me", { headers });
      const profData = await profRes.json();
      if (profData.success) {
        setProfile(profData.profile);
        setCompletion(profData.completion || null);
      } else if (profData.completion) {
        setCompletion(profData.completion);
      }

      const [recRes, appRes, jobsRes, analyticsRes, genRes] = await Promise.all([
        fetch("/api/recommendations/me", { headers }),
        fetch("/api/applications/me", { headers }),
        fetch("/api/jobs", { headers }),
        fetch("/api/analytics/student/me", { headers }),
        fetch("/api/resume-builder/my-resumes", { headers }),
      ]);

      const recData = await recRes.json();
      if (recData.success) {
        setRecommendations((recData.recommendations || []).slice(0, 3));
      }

      const appData = await appRes.json();
      if (appData.success) setApplications(appData.applications || []);

      const jobsData = await jobsRes.json();
      if (jobsData.success) setRecentJobs((jobsData.jobs || []).slice(0, 3));

      const analyticsData = await analyticsRes.json();
      if (analyticsData.success) setStudentAnalytics(analyticsData.data);

      const generatedData = await genRes.json();
      if (generatedData.success) setGeneratedResumes(generatedData.resumes || []);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchProfileAndData();
  }, [token]);

  const handleDeleteResume = async () => {
    if (!window.confirm("Are you sure you want to delete your uploaded resume?")) return;
    setDeletingResume(true);
    setResumeActionMsg("");
    try {
      const res = await fetch("/api/students/profile/resume", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setResumeActionMsg("Resume successfully removed from your profile.");
        await fetchProfileAndData();
      } else {
        alert(data.message || "Failed to delete resume");
      }
    } catch (err) {
      alert("Error deleting resume: " + err.message);
    } finally {
      setDeletingResume(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const percentage = completion?.percentage ?? 0;
  const isComplete = completion?.isComplete === true;
  const missingFields = completion?.missingFields || [];
  const selectedApps = applications.filter((a) => a.status === "Selected");
  const statusSummary = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});
  const resumeReady = !!(profile?.resumeUrl && String(profile.resumeUrl).trim());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-up">
      {flashMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between gap-3 shadow-xs animate-fade-up">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{flashMsg}</span>
          </div>
          <button
            onClick={() => setFlashMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 text-xs rounded hover:bg-emerald-100 transition cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {resumeActionMsg && (
        <div className="mb-6 p-4 rounded-xl bg-teal-soft border border-teal text-teal text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal" />
            <span>{resumeActionMsg}</span>
          </div>
          <button onClick={() => setResumeActionMsg("")} className="p-1 hover:bg-teal/10 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Track your academic portfolio, AI recommendation readiness, and campus recruitment progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={isComplete ? "/student/profile?mode=edit" : "/student/profile?mode=create"}
            className="px-4 py-2.5 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal-deep transition flex items-center gap-2 shadow-sm"
          >
            {isComplete ? "Edit Academic Profile" : "Complete Profile"}
          </Link>
          <Link
            to="/student/resume-builder"
            className="px-4 py-2.5 btn-secondary rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Resume Builder
          </Link>
        </div>
      </div>

      {selectedApps.length > 0 && (
        <div className="mb-8 space-y-3">
          {selectedApps.map((app) => (
            <div
              key={app._id}
              className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 shadow-xs"
            >
              <Award className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-900">
                  Selected for {app.job?.title || "a campus role"}
                  {app.company?.name ? ` at ${app.company.name}` : ""}.
                </h3>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Confirmed after recruiter selection. View details in My Applications.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Completion Card */}
      <div className={`mb-8 p-4 sm:p-6 rounded-2xl border shadow-xs ${
        isComplete ? "bg-surface border-sage" : "bg-amber-50/60 border-amber-200"
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {isComplete ? (
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-ink text-base">
                  {isComplete ? "Academic Profile Complete" : "Profile Incomplete — Action Required"}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {percentage}%
                </span>
              </div>
              <p className="text-sm text-ink-muted mt-1">
                {isComplete
                  ? "Your academic records and verified skills are fully indexed for AI-driven job matching."
                  : `Complete the remaining essential fields (${missingFields.join(", ")}) to unlock full campus placement features.`}
              </p>
            </div>
          </div>
          <Link
            to="/student/profile"
            className="w-full sm:w-auto text-center px-4 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl transition whitespace-nowrap shadow-xs"
          >
            {isComplete ? "Update Profile" : "Complete Missing Fields"}
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full bg-paper rounded-full h-2 overflow-hidden border border-sage/60">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              percentage >= 100 ? "bg-emerald-600" : percentage >= 60 ? "bg-teal" : "bg-amber-500"
            }`}
            style={{ width: `${Math.max(5, percentage)}%` }}
          />
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Academic Status
          </div>
          <div className="mt-2 text-2xl font-bold text-ink">
            CGPA {profile?.cgpa !== undefined && profile?.cgpa > 0 ? profile.cgpa : "—"}
          </div>
          <div className="text-xs text-ink-muted mt-1">
            Backlogs: {profile?.backlogs ?? 0} (Active: {profile?.activeBacklogs ?? 0})
          </div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Degree & Branch
          </div>
          <div className="mt-2 text-lg font-bold text-ink truncate">
            {profile?.degree || "B.Tech"} · {profile?.batch || "—"}
          </div>
          <div className="text-xs text-ink-muted mt-1 truncate">
            {profile?.department || "Not specified"}
          </div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Applications
          </div>
          <div className="mt-2 text-2xl font-bold text-ink">
            {studentAnalytics?.applicationCount ?? applications.length}
          </div>
          <div className="text-xs text-ink-muted mt-1">
            {studentAnalytics?.activeApplications != null
              ? `${studentAnalytics.activeApplications} active · `
              : ""}
            {Object.keys(statusSummary).length === 0
              ? "No applications yet"
              : Object.entries(statusSummary)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(" · ")}
          </div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Placement Status
          </div>
          <div className="mt-2 text-2xl font-bold capitalize text-ink flex items-center gap-2">
            {profile?.placementStatus === "placed" ? (
              <span className="text-emerald-600 flex items-center gap-1.5 text-lg">
                <CheckCircle className="w-5 h-5" /> Placed
              </span>
            ) : profile?.placementStatus === "opted_out" ? (
              <span className="text-ink-muted text-lg">Opted Out</span>
            ) : (
              <span className="text-teal text-lg">Seeking</span>
            )}
          </div>
          <div className="text-xs text-ink-muted mt-1">
            Skills Indexed: {profile?.skills?.length || 0}
          </div>
        </div>
      </div>

      {(studentAnalytics?.upcomingDeadlines?.length > 0 ||
        studentAnalytics?.upcomingOpenDeadlines?.length > 0) && (
        <div className="panel p-4 shadow-xs mb-8">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
            Upcoming recruitment deadlines
          </div>
          <ul className="space-y-1.5 text-sm text-ink">
            {[
              ...(studentAnalytics.upcomingDeadlines || []),
              ...(studentAnalytics.upcomingOpenDeadlines || []),
            ]
              .slice(0, 5)
              .map((d) => (
                <li key={`${d.jobId}-${d.deadline}`} className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <Link
                    to={`/student/jobs?jobId=${encodeURIComponent(d.jobId)}`}
                    className="font-medium text-teal hover:underline"
                  >
                    {d.title}
                  </Link>
                  <span className="text-ink-muted">{d.companyName}</span>
                  <span className="text-ink-muted">
                    {new Date(d.deadline).toLocaleDateString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Profile Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Personal & Academic Summary */}
        <div className="panel p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-teal" />
              <h2 className="text-base font-semibold text-ink">Academic Identity</h2>
            </div>
            <Link to="/student/profile" className="text-xs text-teal hover:underline font-medium">
              Edit
            </Link>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Roll Number</span>
              <span className="font-mono font-semibold text-ink">{profile?.rollNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Program / Degree</span>
              <span className="font-semibold text-ink">{profile?.degree || "B.Tech"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Department</span>
              <span className="font-semibold text-ink text-right">{profile?.department || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Graduation Year</span>
              <span className="font-semibold text-ink">{profile?.batch || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Contact Phone</span>
              <span className="font-semibold text-ink">{profile?.phone || user?.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Email</span>
              <span className="font-semibold text-ink">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Resume Status Card */}
        <div className="panel p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal" />
              <h2 className="text-base font-semibold text-ink">Resume Management</h2>
            </div>
            <Link to="/student/profile" className="text-xs text-teal hover:underline font-medium">
              Manage
            </Link>
          </div>
          {resumeReady ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-paper rounded-xl border border-sage">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink truncate max-w-[180px]">
                    {profile.resumeFileName || "candidate_resume.pdf"}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {profile.resumeFileSize ? `${(profile.resumeFileSize / 1024).toFixed(0)} KB` : "PDF"}
                  </span>
                </div>
                {profile.resumeUpdatedAt && (
                  <div className="text-[10px] text-ink-muted mt-1">
                    Updated {new Date(profile.resumeUpdatedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/students/profile/resume"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-teal hover:bg-teal-deep text-white rounded-lg text-xs font-semibold text-center inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> View / Download
                </a>
                <button
                  type="button"
                  onClick={handleDeleteResume}
                  disabled={deletingResume}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition"
                  title="Delete Resume"
                >
                  {deletingResume ? <ButtonSpinner className="w-3.5 h-3.5" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-ink-muted mb-3">No PDF resume uploaded yet.</p>
              <div className="flex flex-col gap-2 items-center">
                <Link
                  to="/student/resume-builder"
                  className="px-4 py-2 bg-teal text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-teal-deep transition"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Create resume with templates
                </Link>
                <Link
                  to="/student/profile"
                  className="text-xs font-semibold text-teal hover:underline inline-flex items-center gap-1"
                >
                  Or manage from My Profile
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Generated resumes (separate from uploaded resume) */}
        <div className="panel p-6 shadow-xs space-y-4 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal" />
              <h2 className="text-base font-semibold text-ink">Generated Resumes</h2>
            </div>
            <Link
              to="/student/resume-builder"
              className="text-xs text-teal hover:underline font-medium"
            >
              Create new
            </Link>
          </div>
          {generatedResumes.length === 0 ? (
            <p className="text-xs text-ink-muted py-4">
              No generated resume versions yet. Create one from your profile using a template.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {generatedResumes.map((r) => (
                <div
                  key={r._id}
                  className="p-3 rounded-xl border border-sage bg-paper flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">
                      v{r.version} · {String(r.templateId || "").replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                    </p>
                  </div>
                  <a
                    href={`/api/resume-builder/${r._id}/download`}
                    className="px-2.5 py-1.5 bg-teal text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skills & Experience Overview */}
        <div className="panel p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-teal" />
              <h2 className="text-base font-semibold text-ink">Skills & Portfolio</h2>
            </div>
            <Link to="/student/profile" className="text-xs text-teal hover:underline font-medium">
              Add More
            </Link>
          </div>
          <div>
            <div className="text-xs font-semibold text-ink-muted mb-2">Technical Skills</div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(profile?.skills || []).length === 0 ? (
                <span className="text-xs text-ink-muted">No skills recorded</span>
              ) : (
                profile.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-paper rounded-md border border-sage text-[11px] font-medium text-ink">
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-sage/60 flex items-center justify-between text-xs text-ink-muted">
            <span>Projects: {profile?.projects?.length || 0}</span>
            <span>Certifications: {profile?.certifications?.length || 0}</span>
            <span>Experience: {profile?.experience?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* AI Recommendations & Job Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="panel p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal" />
              <h2 className="text-lg font-semibold text-ink">Recommended Jobs</h2>
            </div>
            <Link
              to="/student/recommendations"
              className="text-xs font-semibold text-teal hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!isComplete ? (
            <div className="text-center py-10 text-ink-muted text-sm">
              Complete your profile to receive personalized AI recommendations.
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-10 text-ink-muted text-sm">
              No personalized matches yet. Add skills or check back when more jobs are published.
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((job) => (
                <div
                  key={job.job_id}
                  className="p-4 rounded-xl border border-sage bg-paper hover:bg-teal-soft transition flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-ink text-sm">{job.title}</h3>
                    <p className="text-xs text-ink-muted">{job.company?.name || "Hiring Company"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 bg-teal-soft text-teal rounded-md">
                        {job.match_score}% Match
                      </span>
                      {job.is_eligible ? (
                        <span className="text-[11px] font-semibold text-emerald-700">Eligible</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-600">Ineligible</span>
                      )}
                    </div>
                  </div>
                  <Link to="/student/recommendations" className="p-2 text-teal hover:bg-teal-soft rounded-lg">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal" />
              <h2 className="text-lg font-semibold text-ink">Recent Job Listings</h2>
            </div>
            <Link
              to="/student/jobs"
              className="text-xs font-semibold text-teal hover:underline flex items-center gap-1"
            >
              Browse Jobs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-10 text-ink-muted text-sm">
              No published jobs from verified companies yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job._id}
                  className="p-4 rounded-xl border border-sage bg-paper flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-ink text-sm">{job.title}</h3>
                    <p className="text-xs text-ink-muted">{job.company?.name}</p>
                  </div>
                  <Link
                    to="/student/jobs"
                    className="text-xs font-semibold text-teal hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Applications Section */}
      <div className="panel p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-semibold text-ink">Your Recent Applications</h2>
          </div>
          <Link
            to="/student/applications"
            className="text-xs font-semibold text-teal hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-10 text-ink-muted text-sm">
            You haven&apos;t submitted any applications yet. Explore available jobs to apply.
          </div>
        ) : (
          <div className="space-y-3">
            {applications.slice(0, 5).map((app) => (
              <div
                key={app._id}
                className="p-4 rounded-xl border border-sage bg-paper flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-ink text-sm">{app.job?.title}</h3>
                  <p className="text-xs text-ink-muted">{app.company?.name}</p>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Applied {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-soft text-teal border border-sage">
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
