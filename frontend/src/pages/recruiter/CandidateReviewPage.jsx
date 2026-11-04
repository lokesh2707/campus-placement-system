import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Mail,
  GraduationCap,
  Sparkles,
  Award
} from "lucide-react";

const CandidateReviewPage = () => {
  const { jobId } = useParams();
  const { token } = useAuth();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState({});
  const [statusNote, setStatusNote] = useState({});
  const [msg, setMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const stages = [
    "Applied",
    "Under Review",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected",
  ];

  const fetchApplicants = async () => {
    try {
      const res = await fetch(`/api/applications/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to load applicants:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [jobId, token]);

  const handleUpdateStage = async (appId) => {
    const newStatus = selectedStatus[appId];
    if (!newStatus) return;

    setUpdatingId(appId);
    setMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          note: statusNote[appId] || "",
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to update status");

      setMsg(`Candidate successfully moved to ${newStatus} stage!`);
      await fetchApplicants();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-8 bg-[var(--color-border)] rounded w-1/4"></div>
        <div className="h-44 bg-[var(--color-border)] rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to="/recruiter/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recruiter Hub
        </Link>
        <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
          Applicant Screening & Pipeline
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Review candidate profiles, technical qualifications, and advance their recruitment stage.
        </p>
      </div>

      {msg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-base">No Applications Yet</h3>
          <p className="text-xs text-ink-muted mt-1">
            Eligible students have not submitted applications for this job opening yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app._id}
              className="panel p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-ink">{app.student?.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {app.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted mt-1">
                    <span className="flex items-center gap-1 text-ink">
                      <Mail className="w-3.5 h-3.5" /> {app.student?.email}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-ink font-semibold">
                      <GraduationCap className="w-3.5 h-3.5" /> CGPA: {app.studentProfile?.cgpa || "N/A"}
                    </span>
                    <span>•</span>
                    <span>{app.studentProfile?.department}</span>
                    <span>•</span>
                    <span>Backlogs: {app.studentProfile?.backlogs ?? 0}</span>
                  </div>
                </div>

                {/* Candidate's Skills */}
                <div>
                  <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">
                    Verified Competencies
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {app.studentProfile?.skills?.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-teal-soft text-ink text-xs rounded font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="bg-paper p-4 rounded-xl border border-sage flex flex-col gap-2 w-full md:w-auto md:min-w-[280px]">
                <label className="text-xs font-bold text-ink">
                  Update Candidate Stage
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedStatus[app._id] || app.status}
                    onChange={(e) =>
                      setSelectedStatus({ ...selectedStatus, [app._id]: e.target.value })
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg border border-sage text-xs font-semibold bg-white"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdateStage(app._id)}
                    disabled={updatingId === app._id}
                    className="px-3.5 py-1.5 bg-teal hover:bg-teal-deep text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {updatingId === app._id ? "Saving..." : "Update"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Optional interview/feedback note..."
                  value={statusNote[app._id] || ""}
                  onChange={(e) =>
                    setStatusNote({ ...statusNote, [app._id]: e.target.value })
                  }
                  className="px-2.5 py-1 border border-sage rounded-lg text-[11px] bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidateReviewPage;
