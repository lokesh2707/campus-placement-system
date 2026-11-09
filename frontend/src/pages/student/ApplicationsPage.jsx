import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Building,
  Calendar,
  XCircle
} from "lucide-react";
import { CardSkeleton } from "../../components/Loader";

const ApplicationsPage = () => {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePages, setAttendancePages] = useState(1);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/applications/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications || []);
      }
      const interviewRes = await fetch("/api/students/my-interviews", { headers: { Authorization: `Bearer ${token}` } });
      const interviewData = await interviewRes.json();
      if (interviewData.success) setInterviews(interviewData.rounds || []);
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [token]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      setAttendanceError("");
      try {
        const response = await fetch(`/api/attendance/me?page=${attendancePage}&limit=25`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load attendance history.");
        setAttendance(data.rows || []);
        setAttendancePages(data.pagination?.pages || 1);
      } catch {
        setAttendanceError("Attendance history could not be loaded.");
        setAttendance([]);
      } finally { setAttendanceLoading(false); }
    };
    if (token) fetchAttendance();
  }, [token, attendancePage]);

  const handleWithdraw = async (appId) => {
    if (!window.confirm("Are you sure you want to withdraw this application?")) return;
    setActionMsg("");
    setActionError("");

    try {
      const res = await fetch(`/api/applications/${appId}/withdraw`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to withdraw");
      }

      setActionMsg("Application withdrawn successfully.");
      fetchApplications();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const getStageBadge = (status) => {
    const map = {
      Applied: "bg-blue-100 text-blue-800 border-blue-200",
      Shortlisted: "bg-teal-soft text-teal-deep border-teal/30",
      "Under Review": "bg-accent-soft text-ink border-sage",
      Assessment: "bg-amber-100 text-amber-800 border-amber-200",
      Interview: "bg-teal-soft text-teal border-sage",
      Selected: "bg-emerald-100 text-emerald-800 border-emerald-200",
      Rejected: "bg-red-100 text-red-800 border-red-200",
      Withdrawn: "bg-teal-soft text-ink-muted border-sage",
    };
    return map[status] || "bg-teal-soft text-ink border-sage";
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 space-y-2">
          <div className="h-8 w-60 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-80 rounded skeleton-shimmer" />
        </div>
        <CardSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
          My Applications
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Monitor your application lifecycle, interview stages, and recruiter feedback.
        </p>
      </div>

      {actionMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{actionMsg}</span>
        </div>
      )}

      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}
      <section className="panel p-5 mb-6"><h2 className="font-display font-semibold text-ink">Interview Schedule</h2>{interviews.length ? <div className="mt-3 space-y-2">{interviews.map((r) => <div key={r._id} className="text-xs border border-sage rounded-lg p-3"><b>{r.job?.title || "Job"} — {r.roundName}</b><div className="text-ink-muted mt-1">{new Date(r.scheduledAt).toLocaleString()} · {r.interviewMode} · {r.status}</div>{r.meetingLink && <a className="text-teal block mt-1" href={r.meetingLink} target="_blank" rel="noreferrer">Join meeting</a>}{r.location && <div className="mt-1">{r.location}</div>}</div>)}</div> : <p className="text-xs text-ink-muted mt-2">No interviews scheduled.</p>}</section>

      <section className="panel p-5 mb-6" aria-labelledby="my-attendance-heading">
        <h2 id="my-attendance-heading" className="font-display font-semibold text-ink">Drive attendance</h2>
        <p className="text-xs text-ink-muted mt-1">Attendance is recorded separately from application status.</p>
        {attendanceError ? <p role="alert" className="mt-3 text-sm text-red-700">{attendanceError}</p> : attendanceLoading ? <p role="status" className="mt-3 text-sm text-ink-muted">Loading attendance…</p> : attendance.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No application attendance records to display yet.</p> : <div className="mt-3 space-y-2">{attendance.map((row) => <article key={row.applicationId} className="rounded-lg border border-sage p-3"><p className="font-medium text-ink">{row.job?.title || "Job"} · {row.company?.name || "Company"}</p><p className="text-sm mt-1">{row.status === "NOT_RECORDED" ? "Not recorded" : row.status}</p>{row.recordedAt && <p className="text-xs text-ink-muted mt-1">Recorded {new Date(row.recordedAt).toLocaleString()}</p>}</article>)}</div>}
        {!attendanceError && attendancePages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-xs"><button type="button" className="rounded border border-sage px-3 py-1.5 disabled:opacity-40" disabled={attendancePage <= 1 || attendanceLoading} onClick={() => setAttendancePage((page) => page - 1)}>Previous</button><span>Page {attendancePage} of {attendancePages}</span><button type="button" className="rounded border border-sage px-3 py-1.5 disabled:opacity-40" disabled={attendancePage >= attendancePages || attendanceLoading} onClick={() => setAttendancePage((page) => page + 1)}>Next</button></div>}
      </section>

      {applications.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <ClipboardList className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-base">No Applications Submitted</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto mt-1 mb-5">
            You have not applied for any campus recruitment opportunities yet.
          </p>
          <Link
            to="/student/jobs"
            className="px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal-deep"
          >
            Explore Active Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {applications.map((app) => (
            <div
              key={app._id}
              className="panel p-4 sm:p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sage">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{app.job?.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-ink-muted mt-1">
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Building className="w-3.5 h-3.5" /> {app.company?.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Applied on {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full border ${getStageBadge(
                      app.status
                    )}`}
                  >
                    {app.status}
                  </span>
                  {app.status !== "Selected" &&
                    app.status !== "Rejected" &&
                    app.status !== "Withdrawn" && (
                      <button
                        onClick={() => handleWithdraw(app._id)}
                        className="text-xs font-semibold text-ink-muted hover:text-red-600 transition"
                      >
                        Withdraw
                      </button>
                    )}
                </div>
              </div>

              {/* Status History Timeline */}
              {app.statusHistory && app.statusHistory.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
                    Recruitment Stage History
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {app.statusHistory.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-paper border border-sage rounded-xl text-xs flex flex-col"
                      >
                        <span className="font-semibold text-ink">{step.status}</span>
                        <span className="text-[10px] text-ink-muted">
                          {new Date(step.changedAt).toLocaleDateString()}
                        </span>
                        {step.note && (
                          <span className="text-[11px] text-ink-muted italic mt-0.5">
                            "{step.note}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
