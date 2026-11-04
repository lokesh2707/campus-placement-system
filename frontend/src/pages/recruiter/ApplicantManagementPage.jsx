import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  ArrowUpDown,
  FileText,
  Eye,
  SlidersHorizontal,
  GraduationCap
} from "lucide-react";

const ApplicantManagementPage = () => {
  const { jobId } = useParams();
  const { token } = useAuth();

  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [sortBy, setSortBy] = useState("matchScore_desc");

  // Stage update
  const [updatingId, setUpdatingId] = useState(null);
  const [stageNotes, setStageNotes] = useState({});

  const stages = [
    "Applied",
    "Shortlisted",
    "Under Review",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected",
  ];

  const fetchApplicants = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (eligibilityFilter) params.append("eligibility", eligibilityFilter);
      if (departmentFilter) params.append("department", departmentFilter);
      if (minScoreFilter > 0) params.append("minScore", minScoreFilter);
      if (sortBy) params.append("sortBy", sortBy);

      const res = await fetch(`/api/applications/jobs/${jobId}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load job applicants");
      }

      setJob(data.job || null);
      setApplications(data.applications || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [jobId, statusFilter, eligibilityFilter, departmentFilter, minScoreFilter, sortBy]);

  const handleStageChange = async (appId, newStatus) => {
    setUpdatingId(appId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          note: stageNotes[appId] || `Stage updated to ${newStatus}`,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to update status");

      setSuccessMsg(`Applicant moved to '${newStatus}' successfully!`);
      await fetchApplicants();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter applications by client search query
  const filteredApplications = applications.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = app.student?.name?.toLowerCase().includes(q);
    const emailMatch = app.student?.email?.toLowerCase().includes(q);
    const rollMatch = app.studentProfile?.rollNumber?.toLowerCase().includes(q);
    const skillMatch = app.studentProfile?.skills?.some((s) => s.toLowerCase().includes(q));
    return nameMatch || emailMatch || rollMatch || skillMatch;
  });

  const getEligibilityBadge = (status) => {
    if (status === "Eligible") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Eligible
        </span>
      );
    }
    if (status === "Not eligible") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-600" /> Ineligible
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        Needs review
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const map = {
      Applied: "bg-blue-100 text-blue-800 border-blue-200",
      "Under Review": "bg-purple-100 text-purple-800 border-purple-200",
      Assessment: "bg-amber-100 text-amber-800 border-amber-200",
      Interview: "bg-indigo-100 text-indigo-800 border-indigo-200",
      Selected: "bg-emerald-100 text-emerald-800 border-emerald-200",
      Rejected: "bg-red-100 text-red-800 border-red-200",
      Withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return map[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Navigation */}
      <div className="mb-6">
        <Link
          to="/recruiter/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink mb-3 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recruiter Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
              Applicant Pipeline & AI Screening
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              {job ? (
                <span>
                  Job Opening: <strong className="text-ink">{job.title}</strong> • {applications.length} Total Applicants
                </span>
              ) : (
                "Review candidate applications and evaluate technical qualifications"
              )}
            </p>
          </div>
          {job && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-teal-soft text-ink font-semibold">
                Min CGPA: {job.eligibilityCriteria?.minCgpa ?? 0}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 font-semibold">
                Required Skills: {job.requiredSkills?.length ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="panel p-5 shadow-xs mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-ink-muted" />
            <input
              type="text"
              placeholder="Search candidate name, ID, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-xs font-medium bg-white"
          >
            <option value="">All Recruitment Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Withdrawn">Withdrawn</option>
          </select>

          {/* Eligibility Filter */}
          <select
            value={eligibilityFilter}
            onChange={(e) => setEligibilityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-xs font-medium bg-white"
          >
            <option value="">All Eligibility Statuses</option>
            <option value="Eligible">Eligible Candidates Only</option>
            <option value="Not eligible">Ineligible Candidates</option>
            <option value="Needs review">Needs Review</option>
          </select>

          {/* Department Filter */}
          <input
            type="text"
            placeholder="Filter by Department..."
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-sage text-xs bg-white"
          />

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-sage text-xs font-semibold bg-white"
          >
            <option value="matchScore_desc">Highest AI Match Score</option>
            <option value="matchScore_asc">Lowest AI Match Score</option>
            <option value="cgpa_desc">Highest CGPA</option>
            <option value="name_asc">Candidate Name (A-Z)</option>
          </select>
        </div>

        {/* Score Threshold Slider */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-3 border-t border-sage text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal" />
            <span className="font-semibold text-ink">Minimum AI Score Filter:</span>
            <span className="font-mono font-bold text-teal">{minScoreFilter}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(Number(e.target.value))}
            className="w-full sm:w-48 accent-teal cursor-pointer"
          />
          {minScoreFilter > 0 && (
            <button
              onClick={() => setMinScoreFilter(0)}
              className="text-xs text-ink-muted hover:text-ink underline"
            >
              Reset Score
            </button>
          )}
        </div>
      </div>

      {/* AI Recommended Candidates — eligible applicants ranked by match score */}
      {!loading && applications.length > 0 && (
        <div className="panel p-6 shadow-xs mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-teal" />
            <h2 className="text-base font-semibold text-ink">AI Recommended Candidates</h2>
          </div>
          <p className="text-xs text-ink-muted mb-4">
            Eligible applicants ranked by explainable skill match. AI scores never auto-reject or auto-select candidates.
          </p>
          <div className="space-y-3">
            {applications
              .filter((a) => {
                const elig = a.aiEvaluation?.isEligible;
                return elig === true || elig === undefined;
              })
              .slice()
              .sort(
                (a, b) =>
                  (b.aiEvaluation?.matchScore ?? 0) -
                  (a.aiEvaluation?.matchScore ?? 0)
              )
              .slice(0, 5)
              .map((app) => {
                const evalData = app.aiEvaluation;
                const score = evalData?.matchScore ?? 0;
                return (
                  <div
                    key={`rec-${app._id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-sage bg-paper"
                  >
                    <div>
                      <div className="font-semibold text-ink text-sm">
                        {app.student?.name}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {app.studentProfile?.rollNumber || "N/A"} ·{" "}
                        {app.studentProfile?.department || "Dept N/A"} · CGPA{" "}
                        {app.studentProfile?.cgpa ?? "—"}
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        {evalData?.explanation ||
                          "Awaiting evaluation — open review to generate an AI score."}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-teal">{score}%</span>
                      <Link
                        to={`/recruiter/jobs/${jobId}/applicants/${app._id}/review`}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                );
              })}
            {applications.filter(
              (a) =>
                a.aiEvaluation?.isEligible === true ||
                a.aiEvaluation?.isEligible === undefined
              ).length === 0 && (
              <p className="text-xs text-ink-muted text-center py-4">
                No eligible candidates to recommend yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Applicants Table */}
      {loading ? (
        <div className="panel p-12 text-center text-ink-muted animate-pulse">
          Loading candidate applications and AI scores...
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-base">No Matching Applicants</h3>
          <p className="text-xs text-ink-muted mt-1">
            {applications.length === 0
              ? "No students have applied to this job posting yet."
              : "No candidates match the currently selected search or filters."}
          </p>
        </div>
      ) : (
        <div className="panel shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink font-semibold uppercase tracking-wider border-b border-sage">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Dept & Batch</th>
                  <th className="py-3 px-4">CGPA</th>
                  <th className="py-3 px-4">Eligibility</th>
                  <th className="py-3 px-4">AI Match</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredApplications.map((app) => {
                  const evalData = app.aiEvaluation;
                  const score = evalData?.matchScore ?? 0;
                  return (
                    <tr key={app._id} className="hover:bg-paper transition">
                      {/* Candidate Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-ink text-sm">
                          {app.student?.name}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {app.student?.email}
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-ink">
                        {app.studentProfile?.rollNumber || "N/A"}
                      </td>

                      {/* Dept & Batch */}
                      <td className="py-3.5 px-4">
                        <div className="text-ink font-medium">
                          {app.studentProfile?.department}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          Batch of {app.studentProfile?.batch || "2026"}
                        </div>
                      </td>

                      {/* CGPA & Backlogs */}
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        <div>{app.studentProfile?.cgpa ?? "N/A"}</div>
                        <div className="text-[10px] text-ink-muted">
                          {app.studentProfile?.backlogs ? `${app.studentProfile.backlogs} Backlog(s)` : "0 Backlogs"}
                        </div>
                      </td>

                      {/* Academic Eligibility */}
                      <td className="py-3.5 px-4">
                        {getEligibilityBadge(evalData?.eligibilityStatus)}
                      </td>

                      {/* AI Match Score */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono text-xs border ${
                              score >= 75
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : score >= 50
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-slate-50 text-slate-700 border-slate-300"
                            }`}
                          >
                            {score}%
                          </div>
                          <div className="text-[10px] text-ink-muted leading-tight">
                            <div>Match Score</div>
                            <span className="text-teal font-semibold">
                              {evalData?.matchedRequiredSkills?.length ?? 0} Req Skills
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Application Stage */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/recruiter/jobs/${jobId}/applicants/${app._id}/review`}
                            className="px-3 py-1.5 bg-teal hover:bg-teal-deep text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            AI Review
                          </Link>

                          <select
                            value={app.status}
                            disabled={updatingId === app._id || app.status === "Withdrawn"}
                            onChange={(e) => handleStageChange(app._id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-sage text-xs font-medium bg-white"
                          >
                            {stages.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantManagementPage;
