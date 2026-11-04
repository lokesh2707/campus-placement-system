import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PlusCircle, AlertCircle, CheckCircle2, Building, Plus, X, Pencil } from "lucide-react";

const PostJobPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const isEditMode = Boolean(jobId);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // New Company form toggle
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyLocation, setNewCompanyLocation] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    companyId: "",
    description: "",
    requiredSkills: [],
    preferredSkills: [],
    minCgpa: 7.0,
    allowedDepartments: "Computer Science & Engineering, Information Technology",
    batch: 2026,
    maxBacklogs: 0,
    vacancies: 5,
    deadline: "",
    salaryLpa: 12,
    salaryRange: "10-14 LPA",
    location: "Bengaluru, India",
    employmentType: "full-time",
    status: "open",
  });

  const [reqSkillInput, setReqSkillInput] = useState("");
  const [prefSkillInput, setPrefSkillInput] = useState("");

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/jobs/companies");
      const data = await res.json();
      if (data.success && data.companies) {
        setCompanies(data.companies);
        if (!isEditMode && data.companies.length > 0) {
          setFormData((prev) =>
            prev.companyId ? prev : { ...prev, companyId: data.companies[0]._id }
          );
        }
      }
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg("");
      await fetchCompanies();

      if (isEditMode) {
        try {
          const res = await fetch(`/api/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to load job");
          const job = data.job;
          const companyId =
            typeof job.company === "object" ? job.company?._id : job.company;
          const deadline = job.deadline
            ? new Date(job.deadline).toISOString().slice(0, 10)
            : "";
          setFormData({
            title: job.title || "",
            companyId: companyId || "",
            description: job.description || "",
            requiredSkills: job.requiredSkills || [],
            preferredSkills: job.preferredSkills || [],
            minCgpa: job.eligibilityCriteria?.minCgpa ?? 7.0,
            allowedDepartments: (
              job.eligibilityCriteria?.allowedDepartments || []
            ).join(", "),
            batch: job.eligibilityCriteria?.batch ?? 2026,
            maxBacklogs: job.eligibilityCriteria?.maxBacklogs ?? 0,
            vacancies: job.vacancies ?? 1,
            deadline,
            salaryLpa: job.salary?.lpa ?? 0,
            salaryRange: job.salary?.range || "",
            location: job.location || "",
            employmentType: job.employmentType || "full-time",
            status: job.status || "open",
          });
        } catch (err) {
          setErrorMsg(err.message);
        }
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, token]);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const res = await fetch("/api/jobs/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          location: newCompanyLocation.trim() || "India",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create company");

      await fetchCompanies();
      setFormData((prev) => ({ ...prev, companyId: data.company._id }));
      setCreatingCompany(false);
      setNewCompanyName("");
      setNewCompanyLocation("");
      setSuccessMsg(
        "Company registered. A Placement Officer must verify it before you can publish jobs."
      );
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleAddReqSkill = (e) => {
    e.preventDefault();
    if (!reqSkillInput.trim()) return;
    const s = reqSkillInput.trim();
    if (!formData.requiredSkills.includes(s)) {
      setFormData({ ...formData, requiredSkills: [...formData.requiredSkills, s] });
    }
    setReqSkillInput("");
  };

  const handleAddPrefSkill = (e) => {
    e.preventDefault();
    if (!prefSkillInput.trim()) return;
    const s = prefSkillInput.trim();
    if (!formData.preferredSkills.includes(s)) {
      setFormData({ ...formData, preferredSkills: [...formData.preferredSkills, s] });
    }
    setPrefSkillInput("");
  };

  const handleSubmitJob = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (formData.requiredSkills.length === 0) {
      setErrorMsg("Please specify at least one required technical skill.");
      return;
    }

    if (!isEditMode) {
      const selectedCompany = companies.find((c) => c._id === formData.companyId);
      if (selectedCompany && selectedCompany.isVerified !== true) {
        setErrorMsg(
          "This company is not verified. A Placement Officer must approve it before jobs can be published."
        );
        return;
      }
    }

    setSubmitting(true);

    const depts = formData.allowedDepartments
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const sharedFields = {
      title: formData.title,
      description: formData.description,
      requiredSkills: formData.requiredSkills,
      preferredSkills: formData.preferredSkills,
      eligibilityCriteria: {
        minCgpa: parseFloat(formData.minCgpa) || 0,
        allowedDepartments: depts,
        batch: parseInt(formData.batch, 10) || 2026,
        maxBacklogs: parseInt(formData.maxBacklogs, 10) || 0,
      },
      salary: {
        lpa: parseFloat(formData.salaryLpa) || 0,
        range: formData.salaryRange,
      },
      location: formData.location,
      employmentType: formData.employmentType,
      vacancies: parseInt(formData.vacancies, 10) || 1,
      deadline: formData.deadline || undefined,
    };

    try {
      let res;
      if (isEditMode) {
        res = await fetch(`/api/jobs/${jobId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...sharedFields,
            status: formData.status,
          }),
        });
      } else {
        res = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...sharedFields,
            companyId: formData.companyId,
          }),
        });
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || (isEditMode ? "Failed to update job" : "Failed to publish job")
        );
      }

      setSuccessMsg(
        isEditMode
          ? "Job listing updated successfully! Redirecting to Recruiter Hub..."
          : "Job opening published successfully! Redirecting to Recruiter Hub..."
      );
      setTimeout(() => navigate("/recruiter/dashboard"), 1200);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-sm text-ink-muted">
        {isEditMode ? "Loading job details..." : "Loading companies..."}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
          {isEditMode ? "Edit Job Opening" : "Publish New Job Opening"}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          {isEditMode
            ? "Update role requirements, eligibility criteria, vacancies, or open/closed status."
            : "Specify role requirements, technical skills, and academic eligibility criteria."}
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Add Company Modal / Form */}
      {creatingCompany ? (
        <div className="panel p-6 shadow-sm mb-6 space-y-4 border-teal">
          <div className="flex items-center justify-between border-b border-sage pb-3">
            <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-teal" /> Register Hiring Company
            </h3>
            <button
              onClick={() => setCreatingCompany(false)}
              className="text-xs text-ink-muted hover:text-ink-muted"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Company Name (e.g. Acme Tech)"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              className="px-3.5 py-2 border rounded-xl text-sm"
            />
            <input
              type="text"
              placeholder="Location (e.g. Bengaluru)"
              value={newCompanyLocation}
              onChange={(e) => setNewCompanyLocation(e.target.value)}
              className="px-3.5 py-2 border rounded-xl text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateCompany}
            className="px-4 py-2 bg-teal text-white font-semibold rounded-xl text-xs hover:bg-teal-deep"
          >
            Save Company
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmitJob} className="space-y-6">
        {/* Core Info */}
        <div className="panel p-6 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-ink border-b border-sage pb-2">
            Job & Company Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Job Title
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Full Stack AI Engineer"
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Hiring Company
                </label>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => setCreatingCompany(true)}
                    className="text-xs font-semibold text-teal hover:underline"
                  >
                    + Add Company
                  </button>
                )}
              </div>
              <select
                required
                value={formData.companyId}
                disabled={isEditMode}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white disabled:bg-paper disabled:text-ink-muted"
              >
                {companies.length === 0 ? (
                  <option value="">No companies available. Click '+ Add Company'</option>
                ) : (
                  companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.location || "India"})
                      {c.isVerified === true ? " — Verified" : " — Pending verification"}
                    </option>
                  ))
                )}
              </select>
              {isEditMode && (
                <p className="mt-1 text-[11px] text-ink-muted">
                  Company cannot be changed after the drive is created.
                </p>
              )}
              {!isEditMode &&
                formData.companyId &&
                companies.find((c) => c._id === formData.companyId)?.isVerified !== true && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This company is awaiting Placement Officer approval. Jobs cannot be published until it is verified.
                  </p>
                )}
            </div>

            {isEditMode && (
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Drive Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Location
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Bengaluru, India or Remote"
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Employment Type
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none bg-white"
              >
                <option value="full-time">Full-Time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Number of Vacancies / Openings
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.vacancies}
                onChange={(e) => setFormData({ ...formData, vacancies: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Application Deadline (Optional)
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Job Description
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role responsibilities, projects, and work environment..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-sage text-sm focus:ring-2 focus:ring-teal focus:outline-none"
            />
          </div>
        </div>

        {/* Skills Requirements */}
        <div className="panel p-6 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-ink border-b border-sage pb-2">
            Skill Requirements
          </h2>

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Must-Have Required Skills (Min 1)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={reqSkillInput}
                onChange={(e) => setReqSkillInput(e.target.value)}
                placeholder="e.g. Python, FastAPI, React..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-sage text-sm"
              />
              <button
                type="button"
                onClick={handleAddReqSkill}
                className="px-4 py-2 bg-teal-deep text-white rounded-xl text-xs font-semibold"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-paper rounded-xl min-h-12 border border-sage/60">
              {formData.requiredSkills.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 bg-teal-soft text-teal rounded-md text-xs font-semibold flex items-center gap-1"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        requiredSkills: formData.requiredSkills.filter((item) => item !== s),
                      })
                    }
                  >
                    <X className="w-3 h-3 text-ink-muted hover:text-red-500" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Good-to-Have Preferred Skills (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={prefSkillInput}
                onChange={(e) => setPrefSkillInput(e.target.value)}
                placeholder="e.g. Docker, Redis, Kubernetes..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-sage text-sm"
              />
              <button
                type="button"
                onClick={handleAddPrefSkill}
                className="px-4 py-2 bg-teal-deep text-white rounded-xl text-xs font-semibold"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-paper rounded-xl min-h-12 border border-sage/60">
              {formData.preferredSkills.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 bg-teal-soft text-ink rounded-md text-xs font-medium flex items-center gap-1"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        preferredSkills: formData.preferredSkills.filter((item) => item !== s),
                      })
                    }
                  >
                    <X className="w-3 h-3 text-ink-muted hover:text-red-500" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Eligibility Criteria */}
        <div className="panel p-6 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-ink border-b border-sage pb-2">
            Minimum Academic Eligibility Criteria
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Minimum CGPA (0.0 - 10.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                required
                value={formData.minCgpa}
                onChange={(e) => setFormData({ ...formData, minCgpa: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-sage text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Target Batch Year
              </label>
              <input
                type="number"
                required
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-sage text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Max Allowed Backlogs
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.maxBacklogs}
                onChange={(e) => setFormData({ ...formData, maxBacklogs: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-sage text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
              Eligible Departments (Comma Separated)
            </label>
            <input
              type="text"
              value={formData.allowedDepartments}
              onChange={(e) => setFormData({ ...formData, allowedDepartments: e.target.value })}
              placeholder="e.g. Computer Science & Engineering, Information Technology"
              className="w-full px-3.5 py-2 rounded-xl border border-sage text-sm"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          {isEditMode && (
            <button
              type="button"
              onClick={() => navigate("/recruiter/dashboard")}
              className="w-full sm:w-auto px-6 py-3 border border-sage text-ink font-semibold rounded-xl text-sm hover:bg-paper transition text-center"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3 bg-teal hover:bg-teal-deep text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 text-center"
          >
            {isEditMode ? (
              <>
                <Pencil className="w-4 h-4" />
                {submitting ? "Saving Changes..." : "Save Job Changes"}
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                {submitting ? "Publishing Job..." : "Publish Job Opening"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostJobPage;
