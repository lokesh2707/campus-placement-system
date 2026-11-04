import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Calendar,
  GraduationCap,
  Briefcase,
  Layers,
  Clock,
  RotateCw,
  Award,
  HelpCircle,
  UserCheck
} from "lucide-react";

const ApplicantReviewPage = () => {
  const { jobId, applicationId } = useParams();
  const { token, user } = useAuth();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [selectedStage, setSelectedStage] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const stages = [
    { label: "Shortlist Candidate", value: "Shortlisted", color: "bg-teal hover:bg-teal-deep" },
    { label: "Under Review", value: "Under Review", color: "bg-purple-600 hover:bg-purple-700" },
    { label: "Move to Assessment", value: "Assessment", color: "bg-amber-600 hover:bg-amber-700" },
    { label: "Schedule Interview", value: "Interview", color: "bg-indigo-600 hover:bg-indigo-700" },
    { label: "Extend Offer (Selected)", value: "Selected", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Decline Candidate", value: "Rejected", color: "bg-red-600 hover:bg-red-700" },
  ];

  const fetchApplicationData = async () => {
    try {
      const res = await fetch(`/api/applications/${applicationId}/review`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load candidate application review");
      }

      setApplication(data.application);
      setSelectedStage(data.application?.status || "Applied");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationData();
  }, [applicationId, token]);

  const handleRecalculateAI = async () => {
    setRecalculating(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/applications/${applicationId}/evaluate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to recalculate AI evaluation");
      }

      setApplication(data.application);
      setSuccessMsg("AI evaluation recalculated successfully against current criteria!");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const handleSaveDecision = async (newStage) => {
    setSavingDecision(true);
    setErrorMsg("");
    setSuccessMsg("");

    const targetStage = newStage || selectedStage;

    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStage,
          note: decisionNote.trim() || `Candidate stage transitioned to ${targetStage}`,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update recruitment decision");
      }

      setSuccessMsg(`Decision recorded: candidate moved to '${targetStage}' stage.`);
      setDecisionNote("");
      await fetchApplicationData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingDecision(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center animate-pulse text-ink-muted">
        Loading candidate review and AI analysis...
      </div>
    );
  }

  if (!application) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center panel">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-ink">Application Not Found</h2>
        <p className="text-xs text-ink-muted mt-1 mb-4">
          This application record does not exist or you lack permission to review it.
        </p>
        <Link
          to={`/recruiter/jobs/${jobId}/applicants`}
          className="px-4 py-2 bg-teal text-white rounded-xl text-xs font-semibold"
        >
          Return to Pipeline
        </Link>
      </div>
    );
  }

  const evalData = application.aiEvaluation || {};
  const student = application.student || {};
  const profile = application.studentProfile || {};
  const job = application.job || {};
  const score = evalData.matchScore ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Navigation */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to={`/recruiter/jobs/${jobId}/applicants`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Candidate Pipeline
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
              {student.name}
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-soft text-ink border border-sage">
              {profile.rollNumber || "ID: N/A"}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Applying for <strong className="text-ink">{job.title}</strong> • Applied on{" "}
            {new Date(application.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleRecalculateAI}
            disabled={recalculating}
            className="px-3.5 py-2 border border-sage rounded-xl text-xs font-semibold text-ink hover:bg-paper transition inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-teal ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Re-run AI Evaluation"}
          </button>

          <a
            href={`/api/applications/${applicationId}/resume`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-teal hover:bg-teal-deep text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <FileText className="w-4 h-4" /> View Original Resume PDF
          </a>
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

      {/* Main 3-Column Review Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: AI Evaluation & Eligibility (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Match Gauge Card */}
          <div className="panel p-6 shadow-xs border-2 border-teal-soft">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-teal uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> AI Applicant Match
              </span>
              <span className="text-[10px] text-ink-muted">
                {evalData.evaluatedAt ? new Date(evalData.evaluatedAt).toLocaleTimeString() : "Live"}
              </span>
            </div>

            <div className="text-center py-4">
              <div className="inline-flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 border-teal bg-paper">
                <span className="text-3xl font-extrabold font-mono text-ink">
                  {score}%
                </span>
                <span className="text-[10px] font-semibold text-ink-muted uppercase">
                  Match Score
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-3 max-w-xs mx-auto leading-relaxed">
                {evalData.explanation || "Calculated using 70% required skill overlap, 15% preferred skills, and 15% TF-IDF semantic relevance."}
                {evalData.scoreSource ? (
                  <span className="block mt-1 text-[11px] text-ink-muted">
                    Score source: {evalData.scoreSource === "offline_node"
                      ? "offline Node fallback (text similarity omitted — not interchangeable with full ML scores)"
                      : "ml-service"}
                  </span>
                ) : null}
              </p>
            </div>

            {/* Score Component Breakdown */}
            <div className="mt-4 pt-4 border-t border-sage space-y-2 text-xs">
              <div className="flex justify-between items-center text-ink-muted">
                <span>Required Skills (70% weight):</span>
                <span className="font-semibold text-ink">
                  {evalData.matchedRequiredSkills?.length ?? 0} of {job.requiredSkills?.length ?? 0} matched
                </span>
              </div>
              <div className="flex justify-between items-center text-ink-muted">
                <span>Preferred Skills (15% weight):</span>
                <span className="font-semibold text-ink">
                  {evalData.matchedPreferredSkills?.length ?? 0} of {job.preferredSkills?.length ?? 0} matched
                </span>
              </div>
              <div className="flex justify-between items-center text-ink-muted">
                <span>Resume Semantic Similarity:</span>
                <span className="font-semibold text-ink">
                  {evalData.textSimilarityPercent ?? 0}%
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-paper rounded-xl text-[11px] text-ink-muted italic border border-sage leading-relaxed">
              <strong>Transparency Notice:</strong> {evalData.disclaimer || "Match scores are automated screening aids and do not constitute a statistically guaranteed hiring prediction."}
            </div>
          </div>

          {/* Hard Academic Eligibility Card */}
          <div className="panel p-6 shadow-xs">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
              Academic Eligibility Verdict
            </h3>

            <div className="mb-4">
              {evalData.eligibilityStatus === "Eligible" ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Meets All Eligibility Rules</div>
                    <p className="text-[11px] mt-0.5 text-emerald-800">
                      Candidate satisfies CGPA, graduation batch, department, and backlog criteria.
                    </p>
                  </div>
                </div>
              ) : evalData.eligibilityStatus === "Not eligible" ? (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Mandatory Eligibility Not Met</div>
                    <ul className="list-disc list-inside mt-1 text-[11px] text-red-800 space-y-1">
                      {evalData.eligibilityReasons?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <HelpCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Eligibility Needs Review</div>
                    <p className="text-[11px] mt-0.5 text-amber-800">
                      Required candidate fields are missing from their profile ({evalData.missingData?.join(", ") || "details unrecorded"}).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs border-t border-sage pt-3">
              <div className="flex justify-between">
                <span className="text-ink-muted">Candidate CGPA:</span>
                <span className="font-bold text-ink">{profile.cgpa ?? "N/A"} (Req: {job.eligibilityCriteria?.minCgpa ?? 0})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Candidate Backlogs:</span>
                <span className="font-bold text-ink">{profile.backlogs ?? 0} (Max: {job.eligibilityCriteria?.maxBacklogs ?? 0})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Graduation Batch:</span>
                <span className="font-bold text-ink">{profile.batch || "2026"} (Target: {job.eligibilityCriteria?.batch || "Any"})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Competency Breakdown & Resume Evidence (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Skills Breakdown */}
          <div className="panel p-6 shadow-xs space-y-5">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
              Skill Alignment & Gap Analysis
            </h3>

            {/* Required Skills */}
            <div>
              <div className="text-xs font-bold text-ink flex items-center justify-between mb-2">
                <span>Required Skills ({job.requiredSkills?.length ?? 0})</span>
                <span className="text-[11px] text-teal font-semibold">
                  {evalData.matchedRequiredSkills?.length ?? 0} matched
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {evalData.matchedRequiredSkills?.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {s}
                  </span>
                ))}
                {evalData.missingRequiredSkills?.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs font-medium"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-500" /> {s} (Missing)
                  </span>
                ))}
              </div>
            </div>

            {/* Preferred Skills */}
            {job.preferredSkills?.length > 0 && (
              <div className="pt-3 border-t border-sage">
                <div className="text-xs font-bold text-ink flex items-center justify-between mb-2">
                  <span>Preferred Skills ({job.preferredSkills?.length})</span>
                  <span className="text-[11px] text-ink-muted">
                    {evalData.matchedPreferredSkills?.length ?? 0} matched
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {evalData.matchedPreferredSkills?.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> {s}
                    </span>
                  ))}
                  {evalData.missingPreferredSkills?.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-lg bg-paper text-ink-muted border border-sage text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Extracted Evidence Snippets */}
          <div className="panel p-6 shadow-xs">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal" /> Verified Evidence & Project Highlights
            </h3>

            {evalData.relevantEvidence?.length > 0 ? (
              <div className="space-y-2.5">
                {evalData.relevantEvidence.map((ev, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-paper border border-sage text-xs text-ink leading-relaxed"
                  >
                    {ev}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic">
                No specific resume text excerpts matched keywords for this job opening.
              </p>
            )}

            {/* Candidate Projects */}
            {profile.projects?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-sage">
                <div className="text-xs font-bold text-ink uppercase tracking-wider mb-2">
                  Student Portfolios & Projects
                </div>
                <div className="space-y-2">
                  {profile.projects.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-paper border border-sage text-xs">
                      <div className="font-bold text-ink">{p.title}</div>
                      <div className="text-ink-muted mt-0.5 text-[11px]">{p.description}</div>
                      {p.technologies?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.technologies.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 bg-white text-ink text-[10px] rounded border border-sage">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Recruiter Decisions & Audit Trail (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="panel p-6 shadow-xs border-2 border-sage space-y-5">
            <div>
              <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-1">
                Current Pipeline Stage
              </span>
              <div className="text-xl font-bold text-teal">
                {application.status}
              </div>
            </div>

            {/* Stage Decision Buttons */}
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">
                Advance Candidate Stage
              </label>
              <div className="flex flex-col gap-2">
                {stages.map((stg) => (
                  <button
                    key={stg.value}
                    type="button"
                    disabled={savingDecision || application.status === stg.value}
                    onClick={() => handleSaveDecision(stg.value)}
                    className={`w-full py-2 px-3 text-white text-xs font-bold rounded-xl transition flex items-center justify-between ${
                      stg.color
                    } ${application.status === stg.value ? "opacity-40 cursor-not-allowed ring-2 ring-teal" : ""}`}
                  >
                    <span>{stg.label}</span>
                    {application.status === stg.value && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluation / Interview Notes */}
            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                Recruiter Screening Notes
              </label>
              <textarea
                rows={3}
                placeholder="Add technical interview feedback, screening rationales, or override reasons..."
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-sage text-xs focus:ring-2 focus:ring-teal bg-white"
              />
              <button
                type="button"
                disabled={savingDecision || !decisionNote.trim()}
                onClick={() => handleSaveDecision(application.status)}
                className="mt-2 w-full py-1.5 bg-paper hover:bg-sage border border-sage text-ink text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                {savingDecision ? "Saving Note..." : "Save Note Only"}
              </button>
            </div>
          </div>

          {/* Audit Trail Timeline */}
          <div className="panel p-6 shadow-xs">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-muted" /> Audit History Trail
            </h4>

            <div className="space-y-3">
              {application.statusHistory?.map((h, idx) => (
                <div key={idx} className="relative pl-4 border-l-2 border-teal-soft pb-2 text-xs">
                  <div className="font-bold text-ink">{h.status}</div>
                  <div className="text-[10px] text-ink-muted">
                    {new Date(h.changedAt).toLocaleString()}
                  </div>
                  {h.note && (
                    <div className="text-[11px] text-ink-muted mt-0.5 bg-paper p-1.5 rounded border border-sage">
                      "{h.note}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantReviewPage;
