import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  X,
  Filter
} from "lucide-react";
import { JobCardSkeleton } from "../../components/Loader";

const JobSearchPage = () => {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [applyError, setApplyError] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.append("keyword", keyword.trim());
      if (skillFilter.trim()) params.append("skill", skillFilter.trim());

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const list = data.jobs || [];
        setJobs(list);
        const deepLinkId = searchParams.get("jobId");
        if (deepLinkId) {
          const match = list.find((j) => String(j._id) === String(deepLinkId));
          if (match) {
            setSelectedJob(match);
          } else {
            // Fetch single job if not in filtered list
            try {
              const one = await fetch(`/api/jobs/${deepLinkId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              const oneData = await one.json();
              if (one.ok && (oneData.job || oneData.data)) {
                setSelectedJob(oneData.job || oneData.data);
              }
            } catch (_) {
              /* ignore deep-link miss */
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const closeJobModal = () => {
    setSelectedJob(null);
    setApplyMsg("");
    setApplyError("");
    if (searchParams.get("jobId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("jobId");
      setSearchParams(next, { replace: true });
    }
  };

  const handleApply = async (jobId) => {
    setApplying(true);
    setApplyMsg("");
    setApplyError("");

    try {
      const res = await fetch(`/api/applications/jobs/${jobId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit application");
      }

      setApplyMsg("Application submitted successfully! Track your status on the Applications page.");
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
          Campus Job Listings
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Explore active campus recruitment opportunities, verify eligibility, and submit applications.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <form onSubmit={handleSearch} className="panel p-4 shadow-xs mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by job title or keyword..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-[var(--color-teal)] focus:outline-none"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              placeholder="Filter by skill (e.g. Python, React)..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-[var(--color-teal)] focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-xs"
            >
              Search Opportunities
            </button>
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setSkillFilter("");
                setTimeout(fetchJobs, 10);
              }}
              className="px-4 py-2.5 bg-teal-soft hover:bg-[var(--color-border)] text-ink font-medium rounded-xl text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Job Cards Grid */}
      {loading ? (
        <JobCardSkeleton count={4} />
      ) : jobs.length === 0 ? (
        <div className="panel p-12 text-center shadow-xs">
          <Briefcase className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="font-semibold text-ink text-base">No Jobs Found</h3>
          <p className="text-xs text-ink-muted mt-1">Try adjusting your search criteria or resetting filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="panel p-6 shadow-xs hover:border-teal transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink text-lg">{job.title}</h3>
                    <p className="text-sm font-medium text-ink-muted">{job.company?.name}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 bg-teal-soft text-ink rounded-full capitalize">
                    {job.employmentType}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {job.location}
                  </span>
                  {job.salary?.range && (
                    <span className="flex items-center gap-1 font-semibold text-ink">
                      <DollarSign className="w-3.5 h-3.5" /> {job.salary.range}
                    </span>
                  )}
                  {job.eligibilityCriteria?.minCgpa > 0 && (
                    <span className="px-2 py-0.5 bg-teal-soft text-teal rounded font-medium">
                      Min CGPA: {job.eligibilityCriteria.minCgpa}
                    </span>
                  )}
                  {job.vacancies && (
                    <span className="px-2 py-0.5 bg-paper border border-sage text-ink rounded font-medium">
                      {job.vacancies} Opening{job.vacancies > 1 ? "s" : ""}
                    </span>
                  )}
                  {job.deadline && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="w-3 h-3" /> Ends {new Date(job.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">
                    Required Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {job.requiredSkills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-teal-soft text-ink text-xs rounded font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-sage flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-ink-muted">
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => {
                    setSelectedJob(job);
                    setApplyMsg("");
                    setApplyError("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-xs transition shadow-xs text-center"
                >
                  View Details & Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Details & Apply Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-sage max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-sage flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink text-xl">{selectedJob.title}</h3>
                <p className="text-sm text-ink-muted">{selectedJob.company?.name} • {selectedJob.location}</p>
              </div>
              <button
                onClick={closeJobModal}
                className="p-1 text-ink-muted hover:text-ink-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {applyMsg && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{applyMsg}</span>
                </div>
              )}

              {applyError && (
                <div className="p-3.5 bg-red-50 text-red-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-ink mb-1">Job Description</h4>
                <p className="text-ink-muted leading-relaxed whitespace-pre-line">{selectedJob.description}</p>
              </div>

              <div>
                <h4 className="font-semibold text-ink mb-1.5">Academic Eligibility Criteria</h4>
                <ul className="list-disc list-inside text-ink-muted text-xs space-y-1">
                  <li>Minimum CGPA: <span className="font-semibold">{selectedJob.eligibilityCriteria?.minCgpa ?? "None"}</span></li>
                  <li>Eligible Branches: <span className="font-semibold">{selectedJob.eligibilityCriteria?.allowedDepartments?.join(", ") || "All Branches"}</span></li>
                  <li>Max Permitted Backlogs: <span className="font-semibold">{selectedJob.eligibilityCriteria?.maxBacklogs ?? 0}</span></li>
                  {selectedJob.eligibilityCriteria?.batch && (
                    <li>Target Graduation Batch: <span className="font-semibold">{selectedJob.eligibilityCriteria.batch}</span></li>
                  )}
                  {selectedJob.vacancies && (
                    <li>Available Openings / Vacancies: <span className="font-semibold">{selectedJob.vacancies}</span></li>
                  )}
                  {selectedJob.deadline && (
                    <li>Application Deadline: <span className="font-semibold">{new Date(selectedJob.deadline).toLocaleDateString()}</span></li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-ink mb-1.5">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.requiredSkills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-teal-soft text-teal font-semibold text-xs rounded-md">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {selectedJob.preferredSkills?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-ink mb-1.5">Preferred Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.preferredSkills.map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-teal-soft text-ink font-medium text-xs rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-sage flex items-center justify-end gap-3 bg-paper rounded-b-2xl">
              <button
                type="button"
                onClick={closeJobModal}
                className="px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
              >
                Close
              </button>
              <button
                type="button"
                disabled={applying || !!applyMsg}
                onClick={() => handleApply(selectedJob._id)}
                className="px-6 py-2.5 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50"
              >
                {applying ? "Checking Eligibility & Submitting..." : applyMsg ? "Applied" : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobSearchPage;
