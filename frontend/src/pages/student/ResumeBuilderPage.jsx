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

  const [form, setForm] = useState(emptyForm);
  const [skillDraft, setSkillDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mobilePane, setMobilePane] = useState("editor");

  const validTemplate = Boolean(TEMPLATE_LABELS[templateId]);

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
        if (data.success && data.profile) {
          const p = data.profile;
          // Prefer freshly saved API values; fall back to navigation draft for race/cache gaps
          setForm({
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
            professionalSummary:
              p.professionalSummary || draft?.professionalSummary || "",
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
          });
        } else if (draft) {
          setForm((prev) => ({ ...prev, ...draft, name: draft.name || user?.name || "" }));
        } else {
          setForm((prev) => ({
            ...prev,
            name: user?.name || "",
          }));
        }
      } catch (err) {
        if (mounted) {
          if (draft) {
            setForm((prev) => ({ ...prev, ...draft, name: draft.name || user?.name || "" }));
          } else {
            setError("Failed to load profile for resume builder.");
          }
        }
      } finally {
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

  const handleGenerate = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const idempotencyKey = `gen-${templateId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch("/api/resume-builder/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId,
          idempotencyKey,
          content: {
            ...form,
            snapshot: previewData,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate resume");
      setSuccess("Resume generated successfully. You can download it from your dashboard.");
      setTimeout(() => navigate("/student/dashboard"), 1600);
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
          <p className="text-[11px] font-bold text-teal uppercase tracking-widest">Resume Builder</p>
          <h1 className="text-2xl font-display font-semibold text-ink">
            {TEMPLATE_LABELS[templateId]}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Edit on the left — preview updates instantly. Switching templates keeps your edits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/student/resume-builder"
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
            onClick={handleGenerate}
            disabled={saving}
            className="px-4 py-2 bg-teal hover:bg-teal-deep text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? (
              <>
                <ButtonSpinner className="w-3.5 h-3.5" /> Generating...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save & Generate Resume
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink mb-1">
              Professional summary
            </label>
            <textarea
              rows={4}
              value={form.professionalSummary}
              onChange={(e) => updateField("professionalSummary", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-sage text-xs bg-white"
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
                  className="w-full px-2 py-1.5 rounded-lg border border-sage text-xs"
                  placeholder="Title"
                />
                <textarea
                  rows={2}
                  value={p.description}
                  onChange={(e) => updateProject(idx, "description", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-sage text-xs"
                  placeholder="Original description"
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
