import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Sparkles,
  CheckCircle,
  XCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  X
} from "lucide-react";
import { CardSkeleton } from "../../components/Loader";

const RecommendationsPage = () => {
  const { token } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGapJob, setSelectedGapJob] = useState(null);
  const [gapData, setGapData] = useState(null);
  const [loadingGap, setLoadingGap] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch("/api/recommendations/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setRecommendations(data.recommendations || []);
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [token]);

  const handleOpenGapModal = async (jobId) => {
    setSelectedGapJob(jobId);
    setLoadingGap(true);
    setGapData(null);

    try {
      const res = await fetch(`/api/recommendations/jobs/${jobId}/gap`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setGapData(data.analysis);
      }
    } catch (err) {
      console.error("Failed to load skill gap data:", err);
    } finally {
      setLoadingGap(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 space-y-2">
          <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-96 rounded skeleton-shimmer" />
        </div>
        <CardSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" />
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            AI Job Recommendations
          </h1>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Ranked by our Python AI microservice using 70% required skill overlap, 15% preferred bonus, and 15% TF-IDF cosine semantic similarity.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <Briefcase className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-lg">No Recommendations Yet</h3>
          <p className="text-sm text-ink-muted max-w-md mx-auto mt-1 mb-6">
            Make sure your student profile has technical skills added or upload your resume so our AI engine can compute matches.
          </p>
          <Link
            to="/student/profile"
            className="px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal-deep"
          >
            Update Profile Skills
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {recommendations.map((rec, index) => (
            <div
              key={rec.job_id}
              className={`bg-white p-6 rounded-2xl border shadow-xs transition ${
                index === 0 ? "border-teal ring-2 ring-[rgba(11,95,92,0.15)]" : "border-sage"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-sage">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-soft text-ink">
                      #{index + 1}
                    </span>
                    <h2 className="text-xl font-semibold text-ink">{rec.title}</h2>
                  </div>
                  <p className="text-sm text-ink-muted mt-0.5">
                    {rec.company?.name} • {rec.company?.location || "India"}
                  </p>
                </div>

                {/* Score Badge */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-black text-teal leading-none">
                      {rec.match_score}%
                    </div>
                    <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                      Match Score
                    </span>
                  </div>
                  <div className="h-10 w-px bg-border"></div>
                  <div>
                    {rec.is_eligible ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3.5 h-3.5" /> Eligible
                      </span>
                    ) : rec.eligibility_status === "Needs review" ||
                      (rec.missing_data && rec.missing_data.length > 0) ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                        <AlertTriangle className="w-3.5 h-3.5" /> Needs review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" /> Not eligible
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hard eligibility is separate from match score */}
              {!rec.is_eligible && rec.eligibility_reasons?.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <span className="font-bold">Eligibility Notice:</span>{" "}
                  {rec.eligibility_reasons.join(". ")}
                  {rec.missing_data?.length > 0 && (
                    <span className="block mt-1">
                      Complete your profile fields: {rec.missing_data.join(", ")}.
                    </span>
                  )}
                </div>
              )}

              {/* Explainability Breakdown */}
              <div className="mt-4 text-xs text-ink-muted bg-paper p-3 rounded-xl border border-sage flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-teal flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-ink">Ranking Explanation: </span>
                  {rec.explanation}
                </div>
              </div>

              {/* Skills Tags Match */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-semibold text-ink mb-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Matched Skills ({rec.matched_required_skills.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rec.matched_required_skills.length === 0 ? (
                      <span className="text-ink-muted italic">None</span>
                    ) : (
                      rec.matched_required_skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-ink mb-1.5 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-red-500" /> Missing Required Skills ({rec.missing_required_skills.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rec.missing_required_skills.length === 0 ? (
                      <span className="text-emerald-600 font-medium">All satisfied!</span>
                    ) : (
                      rec.missing_required_skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-medium">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {(rec.matched_preferred_skills?.length > 0 ||
                  rec.missing_preferred_skills?.length > 0) && (
                  <div className="sm:col-span-2">
                    <div className="font-semibold text-ink mb-1.5">
                      Preferred skills — matched {rec.matched_preferred_skills?.length || 0}
                      {typeof rec.text_similarity_percent === "number" && (
                        <span className="text-ink-muted font-normal">
                          {" "}
                          · text similarity {rec.text_similarity_percent}%
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(rec.matched_preferred_skills || []).map((s) => (
                        <span
                          key={`p-${s}`}
                          className="px-2 py-0.5 bg-teal-soft text-teal border border-sage rounded font-medium"
                        >
                          {s}
                        </span>
                      ))}
                      {(rec.missing_preferred_skills || []).map((s) => (
                        <span
                          key={`mp-${s}`}
                          className="px-2 py-0.5 bg-paper text-ink-muted border border-sage rounded font-medium"
                        >
                          {s} (missing)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 pt-4 border-t border-sage flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-ink-muted italic">
                  {rec.disclaimer}
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleOpenGapModal(rec.job_id)}
                    className="px-3.5 py-2 bg-teal-soft hover:bg-border text-ink rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-teal" /> Analyze Skill Gaps
                  </button>
                  <Link
                    to={`/student/jobs?jobId=${encodeURIComponent(rec.job_id)}`}
                    className="px-4 py-2 bg-teal hover:bg-teal-deep text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition text-center"
                  >
                    View Job & Apply <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Gap Analysis Modal */}
      {selectedGapJob && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-xl border border-sage max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-sage flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-ink text-base">
                  Actionable Skill-Gap Breakdown
                </h3>
              </div>
              <button
                onClick={() => setSelectedGapJob(null)}
                className="p-1 text-ink-muted hover:text-ink-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {loadingGap ? (
                <div className="text-center py-10 text-ink-muted text-sm animate-pulse">
                  Computing targeted learning recommendations...
                </div>
              ) : gapData ? (
                <>
                  <div>
                    <h4 className="font-semibold text-ink text-sm">{gapData.job_title}</h4>
                    <p className="text-xs text-ink-muted mt-0.5">{gapData.explanation}</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {gapData.gaps.length === 0 ? (
                      <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" /> You meet all technical requirements for this role!
                      </div>
                    ) : (
                      gapData.gaps.map((gap, idx) => (
                        <div key={idx} className="p-3.5 bg-paper rounded-xl border border-sage">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-ink text-sm">{gap.skill}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                gap.priority.includes("High")
                                  ? "bg-teal-soft text-teal-deep"
                                  : "bg-teal-soft text-teal"
                              }`}
                            >
                              {gap.priority}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted">{gap.learning_suggestion}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="text-[11px] text-ink-muted italic pt-2">
                    {gapData.limitations_notice}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-sm text-red-500">
                  Unable to load skill gap data.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsPage;
