import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Briefcase,
  Users,
  PlusCircle,
  Building,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  School,
  ExternalLink,
  Lock,
  Pencil,
} from "lucide-react";

const RecruiterDashboard = () => {
  const { token, user } = useAuth();
  const [companyData, setCompanyData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const loadRecruiterData = async () => {
      try {
        setError("");
        const [compRes, jobsRes, overviewRes] = await Promise.all([
          fetch("/api/recruiter/company", { headers: authHeaders }),
          fetch("/api/recruiter/jobs", { headers: authHeaders }),
          fetch("/api/recruiter/overview", { headers: authHeaders }),
        ]);

        const compJson = await compRes.json();
        const jobsJson = await jobsRes.json();
        const overviewJson = await overviewRes.json();

        if (compJson.success) setCompanyData(compJson.data);
        if (jobsJson.success) setJobs(jobsJson.data || []);
        if (overviewJson.success) setOverview(overviewJson.data);
      } catch (err) {
        console.error("Failed to load recruiter data:", err);
        setError("Failed to load recruiter workspace. Please refresh or try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadRecruiterData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="h-8 bg-border rounded w-1/4"></div>
        <div className="h-28 bg-border rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-28 bg-border rounded-2xl"></div>
          <div className="h-28 bg-border rounded-2xl"></div>
          <div className="h-28 bg-border rounded-2xl"></div>
          <div className="h-28 bg-border rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // GET /api/recruiter/company returns the company document flattened under `data` (not data.company)
  const company = companyData?.name ? companyData : companyData?.company || null;
  const isVerified = company?.isVerified === true;
  const metrics = {
    activeJobs:
      overview?.openJobs ??
      jobs.filter((j) => j.status === "open").length,
    totalJobs: overview?.totalJobs ?? jobs.length,
    totalApplications:
      overview?.activeApplications ??
      overview?.totalApplications ??
      companyData?.stats?.applicants ??
      0,
    shortlisted: overview?.shortlisted ?? 0,
    interview: overview?.interview ?? 0,
    selected: overview?.selected ?? 0,
    rejected: overview?.rejected ?? 0,
  };
  const authorizedCampuses =
    company?.authorizedInstitutes || overview?.authorizedInstitutes || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Mandatory Password Change Warning Banner */}
      {user?.mustChangePassword && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Security Notice: Temporary Password Active</p>
              <p className="text-xs text-amber-800 mt-0.5">
                You are currently logged in with a temporary password issued by your campus placement administrator. You must set a permanent password to secure your recruiter account.
              </p>
            </div>
          </div>
          <Link
            to="/change-password"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shrink-0 text-center"
          >
            Change Password Now
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Recruiter Workspace
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Enterprise recruitment hub for publishing job openings and reviewing campus applicants.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isVerified ? (
            <Link
              to="/recruiter/post-job"
              className="btn-primary w-full sm:w-auto px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> Post New Job
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="btn-secondary w-full sm:w-auto px-5 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
              title="Company verification required before posting open drives"
            >
              <PlusCircle className="w-4 h-4" /> Post New Job (Verification Pending)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Company Association Banner */}
      <div className="panel p-6 shadow-xs mb-8 border border-sage">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-soft flex items-center justify-center shrink-0 border border-teal/20 text-teal">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-ink">{company?.name || "Corporate Partner"}</h2>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-100 text-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    Platform Verified Enterprise
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    Platform Verification Pending
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted mt-2">
                {company?.industry && <span>Industry: <strong className="text-ink">{company.industry}</strong></span>}
                {company?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-ink-muted/80" /> {company.location}
                  </span>
                )}
                {company?.website && (
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal hover:underline inline-flex items-center gap-1"
                  >
                    <span>{company.website}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Recruiter Account
            </div>
            <div className="text-sm font-bold text-ink mt-0.5">{user?.name}</div>
            <div className="text-xs text-ink-muted">{user?.email}</div>
          </div>
        </div>

        {!isVerified && (
          <div className="mt-4 pt-4 border-t border-sage text-xs text-amber-800 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
            <strong>Platform Verification in Progress:</strong> Super Administrators review and verify enterprise credentials. Once verified, open jobs posted by your organization will become visible to eligible candidates at authorized partner campuses.
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Active Job Openings
          </div>
          <div className="mt-2 text-2xl font-bold text-teal">{metrics.activeJobs || 0}</div>
          <div className="text-xs text-ink-muted mt-1">Open campus recruitment drives</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Total Job Drives
          </div>
          <div className="mt-2 text-2xl font-bold text-ink">{metrics.totalJobs || jobs.length}</div>
          <div className="text-xs text-ink-muted mt-1">Open, closed, and draft positions</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Active Applications
          </div>
          <div className="mt-2 text-2xl font-bold text-ink">{metrics.totalApplications || 0}</div>
          <div className="text-xs text-ink-muted mt-1">Excludes withdrawn / offer-resolved</div>
        </div>

        <div className="panel p-5 shadow-xs">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Authorized Campuses
          </div>
          <div className="mt-2 text-2xl font-bold text-ink">{authorizedCampuses.length}</div>
          <div className="text-xs text-ink-muted mt-1">Partner colleges recruiting for company</div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="panel p-4 shadow-xs">
          <div className="text-xs text-ink-muted">Shortlisted</div>
          <div className="text-xl font-bold text-ink">{metrics.shortlisted || 0}</div>
        </div>
        <div className="panel p-4 shadow-xs">
          <div className="text-xs text-ink-muted">Interview</div>
          <div className="text-xl font-bold text-ink">{metrics.interview || 0}</div>
        </div>
        <div className="panel p-4 shadow-xs">
          <div className="text-xs text-ink-muted">Selected (pipeline)</div>
          <div className="text-xl font-bold text-teal">{metrics.selected || 0}</div>
        </div>
        <div className="panel p-4 shadow-xs">
          <div className="text-xs text-ink-muted">Rejected</div>
          <div className="text-xl font-bold text-ink">{metrics.rejected || 0}</div>
        </div>
      </div>

      {/* Authorized Campuses Section (if any) */}
      {authorizedCampuses.length > 0 && (
        <div className="panel p-5 shadow-xs mb-8">
          <div className="flex items-center gap-2 mb-3">
            <School className="w-4 h-4 text-teal" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
              Authorized Campus Placement Cells
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {authorizedCampuses.map((inst) => (
              <span
                key={inst._id || inst.name}
                className="px-3 py-1.5 rounded-xl bg-teal-soft text-teal-deep text-xs font-semibold border border-teal/20 flex items-center gap-1.5"
              >
                <School className="w-3.5 h-3.5" />
                <span>{inst.name}</span>
                {inst.code && <span className="text-[10px] opacity-75">({inst.code})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Posted Jobs Section */}
      <div className="panel shadow-xs overflow-hidden">
        <div className="p-6 border-b border-sage flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your Company Job Listings</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Review live drives, criteria, and applicants for {company?.name}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-teal-soft text-teal-deep rounded-lg">
            {jobs.length} Listing{jobs.length === 1 ? "" : "s"}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center text-ink-muted text-sm space-y-3">
            <Briefcase className="w-8 h-8 text-ink-muted/50 mx-auto" />
            <p>You haven't posted any jobs yet.</p>
            {isVerified && (
              <Link
                to="/recruiter/post-job"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-xl text-xs font-semibold hover:bg-teal-deep transition"
              >
                <PlusCircle className="w-4 h-4" /> Post Your First Job Drive
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink text-base">{job.title}</h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        job.status === "open"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <span className="font-medium text-ink">{job.company?.name || company?.name}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {job.location || "Remote / On-site"}
                    </span>
                    <span>•</span>
                    <span>Min CGPA: {job.eligibilityCriteria?.minCgpa || 0}</span>
                    <span>•</span>
                    <span className="font-bold text-teal flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {job.applicationCount ?? 0} Candidate{(job.applicationCount ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  {job.requiredSkills && job.requiredSkills.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {job.requiredSkills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-paper text-ink rounded text-xs font-medium border border-sage">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/recruiter/jobs/${job._id}/edit`}
                    className="px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap rounded-xl border border-sage text-ink hover:bg-paper"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <Link
                    to={`/recruiter/jobs/${job._id}/applicants`}
                    className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5" /> Review Applicants ({job.applicationCount ?? 0})
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
