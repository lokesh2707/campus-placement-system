import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ResumePreview from "../../components/resume/ResumePreview";
import { buildPreviewData } from "../../utils/resumeContent";
import { ButtonSpinner } from "../../components/Loader";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";

const TEMPLATE_LABELS = {
  modern_ats_professional: "Modern ATS Professional",
  modern_minimalist: "Modern Minimalist",
  technical_developer: "Technical Developer",
  corporate_experienced: "Corporate Experienced",
  fresher_graduate: "Fresher / Graduate",
  // legacy aliases
  ats_professional: "Modern ATS Professional",
  modern_graduate: "Fresher / Graduate",
  developer_portfolio: "Technical Developer",
};

const emptyForm = {
  name: "",
  phone: "",
  rollNumber: "",
  degree: "B.Tech",
  department: "",
  batch: "",
  cgpa: "",
  instituteName: "",
  collegeStartYear: "",
  intermediateName: "",
  intermediateDuration: "",
  schoolName: "",
  schoolDuration: "",
  tenthPercentage: "",
  twelfthPercentage: "",
  professionalSummary: "",
  githubUrl: "",
  linkedinUrl: "",
  portfolioUrl: "",
  skills: [],
  projects: [],
  experience: [],
  certifications: [],
};

const ResumeBuilderPage = () => {
  const { templateId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const draft = location.state?.profileDraft || null;
  const replaceResumeId = location.state?.replaceResumeId || null;
  const updatingResume = Boolean(location.state?.updatingResume && replaceResumeId);

  const [form, setForm] = useState(emptyForm);
  const [skillDraft, setSkillDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mobilePane, setMobilePane] = useState("editor");
  const [showFileNameModal, setShowFileNameModal] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("");
  const [improvingSummary, setImprovingSummary] = useState(false);
  const [summaryAiSuccess, setSummaryAiSuccess] = useState(false);
  const [improvingProjectIndex, setImprovingProjectIndex] = useState(null);

  const validTemplate = Boolean(TEMPLATE_LABELS[templateId]);

  const buildFallbackSummary = (profileLike) => {
    const degree = profileLike.degree || "B.Tech";
    const dept = profileLike.department || "Computer Science";
    const skills = (profileLike.skills || []).slice(0, 6).join(", ");
    const batch = profileLike.batch ? ` (batch ${profileLike.batch})` : "";
    const skillPart = skills
      ? ` Skilled in ${skills}.`
      : " Focused on building reliable software applications.";
    return `${degree} student in ${dept}${batch} seeking a software development role.${skillPart}`;
  };

  useEffect(() => {
    // Template gallery page has no :templateId — skip load there
    if (templateId && !validTemplate) return;
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/students/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;

        let nextForm = null;
        if (data.success && data.profile) {
          const p = data.profile;
          // Prefer freshly saved API values; fall back to navigation draft for race/cache gaps
          // professionalSummary is NOT taken from profile — generated for the resume only
          nextForm = {
            name: p.user?.name || draft?.name || user?.name || "",
            phone: p.phone || draft?.phone || "",
            rollNumber: p.rollNumber || draft?.rollNumber || "",
            degree: p.degree || draft?.degree || "B.Tech",
            department: p.department || draft?.department || "",
            batch: p.batch || draft?.batch || "",
            cgpa: p.cgpa ?? draft?.cgpa ?? "",
            instituteName:
              (typeof p.institute === "object" ? p.institute?.name || "" : "") ||
              draft?.instituteName ||
              "",
            collegeStartYear:
              p.academicHistory?.collegeStartYear ?? draft?.collegeStartYear ?? "",
            intermediateName:
              p.academicHistory?.intermediateName || draft?.intermediateName || "",
            intermediateDuration:
              p.academicHistory?.intermediateDuration || draft?.intermediateDuration || "",
            schoolName: p.academicHistory?.schoolName || draft?.schoolName || "",
            schoolDuration: p.academicHistory?.schoolDuration || draft?.schoolDuration || "",
            tenthPercentage:
              p.academicHistory?.tenthPercentage ?? draft?.tenthPercentage ?? "",
            twelfthPercentage:
              p.academicHistory?.twelfthPercentage ?? draft?.twelfthPercentage ?? "",
            professionalSummary: "",
            githubUrl: p.githubUrl || draft?.githubUrl || "",
            linkedinUrl: p.linkedinUrl || draft?.linkedinUrl || "",
            portfolioUrl: p.portfolioUrl || draft?.portfolioUrl || "",
            skills: (p.skills && p.skills.length ? p.skills : null) || draft?.skills || [],
            projects: (
              (p.projects && p.projects.length ? p.projects : null) ||
              draft?.projects ||
              []
            ).map((proj) => ({
              title: proj.title || "",
              description: proj.description || "",
              technologies: proj.technologies || [],
              githubUrl: proj.githubUrl || "",
              liveUrl: proj.liveUrl || "",
              link: proj.link || "",
              aiEnhancedDescription: proj.aiEnhancedDescription || "",
              aiEnhancedApproved: Boolean(proj.aiEnhancedApproved),
              aiEnhancedSourceHash: proj.aiEnhancedSourceHash || "",
            })),
            experience:
              (p.experience && p.experience.length ? p.experience : null) ||
              draft?.experience ||
              [],
            certifications:
              (p.certifications && p.certifications.length ? p.certifications : null) ||
              draft?.certifications ||
              [],
          };
        } else if (draft) {
          nextForm = {
            ...emptyForm,
            ...draft,
            name: draft.name || user?.name || "",
            professionalSummary: "",
          };
        } else {
          nextForm = { ...emptyForm, name: user?.name || "" };
        }

        nextForm.professionalSummary = buildFallbackSummary(nextForm);
        setForm(nextForm);
        setLoading(false);
      } catch (err) {
        if (mounted) {
          if (draft) {
            setForm({
              ...emptyForm,
              ...draft,
              name: draft.name || user?.name || "",
              professionalSummary: buildFallbackSummary(draft),
            });
          } else {
            setError("Failed to load profile for resume builder.");
          }
        }
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [token, user, validTemplate, templateId, draft]);

  const previewData = useMemo(
    () => buildPreviewData({ user, form }),
    [user, form]
  );

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateProject = (index, key, value) => {
    setForm((prev) => {
      const projects = [...prev.projects];
      projects[index] = { ...projects[index], [key]: value };
      if (key === "description" || key === "title") {
        projects[index].aiEnhancedApproved = false;
      }
      return { ...prev, projects };
    });
  };

  const addSkill = () => {
    const s = skillDraft.trim();
    if (!s) return;
    if (form.skills.includes(s)) {
      setSkillDraft("");
      return;
    }
    updateField("skills", [...form.skills, s]);
    setSkillDraft("");
  };

  const handleImproveSummary = async () => {
    setImprovingSummary(true);
    setError("");
    setSummaryAiSuccess(false);
    try {
      const res = await fetch("/api/resume-builder/ai/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentSummary: form.professionalSummary,
          name: form.name,
          degree: form.degree,
          department: form.department,
          batch: form.batch,
          cgpa: form.cgpa,
          skills: form.skills,
          projects: form.projects,
          experience: form.experience,
          certifications: form.certifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to improve summary with AI");
      }
      if (data.summary) {
        updateField("professionalSummary", data.summary);
        setSummaryAiSuccess(true);
        setTimeout(() => setSummaryAiSuccess(false), 4000);
      }
    } catch (err) {
      setError(err.message || "Failed to improve summary with AI. Please try again.");
    } finally {
      setImprovingSummary(false);
    }
  };

  const handleImproveProjectDescription = async (index) => {
    const proj = form.projects[index];
    if (!proj?.title?.trim() || !proj?.description?.trim()) {
      setError("Add a project title and description before improving with AI.");
      return;
    }
    setImprovingProjectIndex(index);
    setError("");
    try {
      const res = await fetch("/api/resume-builder/ai/project-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: proj.title,
          description: proj.description,
          technologies: proj.technologies || [],
          projectIndex: index,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to improve project description");
      if (data.improvedDescription) {
        updateProject(index, "description", data.improvedDescription);
      }
    } catch (err) {
      setError(err.message || "Failed to improve project description with AI.");
    } finally {
      setImprovingProjectIndex(null);
    }
  };

  const openGenerateModal = () => {
    setError("");
    setSuccess("");
    const person = (form.name || user?.name || "My")
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    setDownloadFileName(`${person || "My"}_Resume`);
    setShowFileNameModal(true);
  };

  const handleGenerate = async () => {
    const rawName = String(downloadFileName || "").trim();
    if (!rawName) {
      setError("Enter a file name for your resume PDF.");
      return;
    }

    setShowFileNameModal(false);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const idempotencyKey = `gen-${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let res = await fetch("/api/resume-builder/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId,
          idempotencyKey,
          fileName: rawName,
          ...(replaceResumeId ? { replaceResumeId } : {}),
          content: {
            ...form,
            snapshot: previewData,
          },
        }),
      });
      let data = await res.json();

      // If replacing failed because the old resume was not found, automatically retry as a fresh new resume
      if (!res.ok && (res.status === 404 || /not found/i.test(data?.message || "")) && replaceResumeId) {
        const retryKey = `gen-${templateId}-${Date.now()}-fallback`;
        res = await fetch("/api/resume-builder/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateId,
            idempotencyKey: retryKey,
            fileName: rawName,
            content: {
              ...form,
              snapshot: previewData,
            },
          }),
        });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.message || "Failed to generate resume");

      const resumeId = data.resume?._id;
      const fileName = data.resume?.fileName || `${rawName.replace(/\.pdf$/i, "")}.pdf`;

      if (resumeId) {
        const dlRes = await fetch(`/api/resume-builder/${resumeId}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!dlRes.ok) {
          throw new Error("Resume was created but download failed. Try again from your dashboard.");
        }
        const blob = await dlRes.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      setSuccess(
        data.replaced || updatingResume
          ? "Resume updated and download started."
          : "Resume generated and download started."
      );
      setTimeout(() => {
        if (updatingResume) {
          navigate("/student/profile", {
            replace: true,
            state: { resumeUpdated: true },
          });
        } else {
          navigate("/student/dashboard");
        }
      }, 1200);
    } catch (err) {
      setError(err.message || "Resume generation failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!validTemplate) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-ink font-semibold">Unknown template.</p>
        <Link to="/student/resume-builder" className="text-teal text-sm font-semibold mt-3 inline-block">
          Choose a template
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-ink-muted">Loading builder...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-teal uppercase tracking-widest">
            {updatingResume ? "Update Resume" : "Resume Builder"}
          </p>
          <h1 className="text-2xl font-display font-semibold text-ink">
            {TEMPLATE_LABELS[templateId]}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {updatingResume
              ? "Review your latest profile details, then generate to replace your previous resume PDF."
              : "Edit on the left — preview updates instantly. Switching templates keeps your edits."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/student/resume-builder"
            state={
              draft || replaceResumeId
                ? {
                    ...(draft ? { profileDraft: draft } : {}),
                    ...(replaceResumeId ? { replaceResumeId, updatingResume: true } : {}),
                  }
                : undefined
            }
            className="btn-secondary px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Change template
          </Link>
          <Link
            to="/student/profile"
            className="btn-secondary px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Profile
          </Link>
          <button
            type="button"
            onClick={openGenerateModal}
            disabled={saving}
            className="px-4 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? (
              <>
                <ButtonSpinner className="w-3.5 h-3.5" /> Generating...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {updatingResume ? "Replace & Download Resume" : "Save & Generate Resume"}
              </>
            )}
          </button>
        </div>
      </div>

      {showFileNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-[2px]"
          onClick={() => !saving && setShowFileNameModal(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white border border-sage p-6 shadow-xl font-body"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-teal">
              {updatingResume ? "Replace" : "Generate"}
            </p>
            <p className="text-lg font-semibold text-ink mt-1 font-body">Name your PDF file</p>
            <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">
              {updatingResume
                ? "This will replace your previous resume file with one built from your latest profile."
                : "Pick a clear name before we create and download your resume."}
            </p>
            <label
              htmlFor="builder-resume-filename"
              className="block text-xs font-semibold text-ink mt-5 mb-1.5"
            >
              File name
            </label>
            <div className="flex items-stretch rounded-xl border border-sage overflow-hidden focus-within:ring-2 focus-within:ring-teal bg-white">
              <input
                id="builder-resume-filename"
                type="text"
                autoFocus
                value={downloadFileName}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDownloadFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleGenerate();
                  }
                  if (e.key === "Escape") setShowFileNameModal(false);
                }}
                placeholder="e.g. Prasanth_Resume"
                className="flex-1 px-3.5 py-3 text-sm text-ink focus:outline-none bg-transparent font-body"
              />
              <span className="px-3 flex items-center text-sm font-semibold text-ink-muted bg-paper border-l border-sage">
                .pdf
              </span>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFileNameModal(false)}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-sage text-ink hover:bg-paper disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={saving}
                className="px-5 py-2.5 bg-teal hover:bg-teal-deep text-white text-sm font-semibold rounded-xl disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <ButtonSpinner className="w-4 h-4" /> Generating...
                  </>
                ) : updatingResume ? (
                  "Replace & Download"
                ) : (
                  "Generate & Download"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="wrap-break-word whitespace-pre-wrap leading-relaxed">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="md:hidden flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMobilePane("editor")}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
            mobilePane === "editor" ? "bg-teal text-white" : "border border-sage"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
            mobilePane === "preview" ? "bg-teal text-white" : "border border-sage"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${mobilePane === "preview" ? "hidden md:block" : ""} panel p-4 space-y-4 max-h-[80vh] overflow-y-auto`}>
          <h2 className="text-sm font-semibold text-ink border-b border-sage pb-2">Profile Editor</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full name" value={form.name} onChange={(v) => updateField("name", v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => updateField("phone", v)} />
            <Field label="Degree" value={form.degree} onChange={(v) => updateField("degree", v)} />
            <Field
              label="Department"
              value={form.department}
              onChange={(v) => updateField("department", v)}
            />
            <Field
              label="GitHub URL"
              value={form.githubUrl}
              onChange={(v) => updateField("githubUrl", v)}
            />
            <Field
              label="LinkedIn URL"
              value={form.linkedinUrl}
              onChange={(v) => updateField("linkedinUrl", v)}
            />
            <div className="sm:col-span-2">
              <Field
                label="Portfolio URL"
                value={form.portfolioUrl}
                onChange={(v) => updateField("portfolioUrl", v)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink">
                Professional summary
              </label>
              <button
                type="button"
                onClick={handleImproveSummary}
                disabled={improvingSummary}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal/10 hover:bg-teal/20 text-teal border border-teal/20 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                title="Improve professional summary with AI"
              >
                {improvingSummary ? (
                  <>
                    <ButtonSpinner className="w-3 h-3 text-teal" />
                    <span>Improving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-teal" />
                    <span>Improve with AI</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] text-ink-muted">
                Prefills from your profile details. Edit for this resume only — not stored on your profile.
              </p>
              {summaryAiSuccess && (
                <span className="text-[10px] font-semibold text-emerald-600 inline-flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Improved!
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={form.professionalSummary}
              onChange={(e) => updateField("professionalSummary", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition font-body"
              placeholder="Brief professional summary..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink mb-1">
              Skills
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-sage text-xs"
                placeholder="Add skill"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-2 bg-teal text-white rounded-xl text-xs font-semibold"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField("skills", form.skills.filter((x) => x !== s))}
                  className="px-2 py-0.5 bg-paper border border-sage rounded text-[11px]"
                  title="Remove"
                >
                  {s} ×
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Projects</h3>
            {form.projects.map((p, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-sage bg-paper space-y-2">
                <input
                  value={p.title}
                  onChange={(e) => updateProject(idx, "title", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-sage text-xs font-medium"
                  placeholder="Title"
                />
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <label className="text-[10px] font-semibold text-ink-muted uppercase">Description</label>
                  <button
                    type="button"
                    onClick={() => handleImproveProjectDescription(idx)}
                    disabled={improvingProjectIndex === idx}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal-deep disabled:opacity-50"
                    title="Improve project description with AI"
                  >
                    {improvingProjectIndex === idx ? (
                      <>
                        <ButtonSpinner className="w-3 h-3 text-teal" />
                        <span>Improving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-teal" />
                        <span>Improve with AI</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={p.description}
                  onChange={(e) => updateProject(idx, "description", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-sage text-xs bg-white"
                  placeholder="Project description & key contributions..."
                />
                {p.aiEnhancedApproved && p.aiEnhancedDescription && (
                  <p className="text-[11px] text-emerald-700">
                    Resume will use approved AI description.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`${mobilePane === "editor" ? "hidden md:block" : ""} max-h-[80vh] overflow-y-auto`}>
          <ResumePreview data={previewData} templateId={templateId} />
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink mb-1">
      {label}
    </label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white"
    />
  </div>
);

export default ResumeBuilderPage;
