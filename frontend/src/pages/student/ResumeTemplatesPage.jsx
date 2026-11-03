import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { TemplateThumbnail } from "../../components/resume/TemplateThumbnails";

const FALLBACK_TEMPLATES = [
  {
    id: "modern_ats_professional",
    name: "Modern ATS Professional",
    tagline: "Best for campus drives & ATS filters",
    description:
      "Single-column ATS layout with professional summary, categorized skills, experience, projects and education.",
    badge: "Most popular",
  },
  {
    id: "modern_minimalist",
    name: "Modern Minimalist",
    tagline: "Clean & focused",
    description:
      "Airy minimalist design with About Me, core competencies, technical expertise and selected projects.",
    badge: "Clean look",
  },
  {
    id: "technical_developer",
    name: "Technical Developer",
    tagline: "Skills & stack first",
    description:
      "Developer-focused layout with a tech sidebar feel, programming skills, stack, projects and experience.",
    badge: "For SDE roles",
  },
  {
    id: "corporate_experienced",
    name: "Corporate Experienced",
    tagline: "Experience-led",
    description:
      "Corporate structure with executive summary, detailed work history, skills and key project impact.",
    badge: "Experienced",
  },
  {
    id: "fresher_graduate",
    name: "Fresher / Graduate",
    tagline: "Ideal for first job",
    description:
      "Graduate layout with career objective, technical skills, academic projects, internships and education.",
    badge: "Fresher",
  },
];

const META_BY_ID = Object.fromEntries(FALLBACK_TEMPLATES.map((t) => [t.id, t]));

const ResumeTemplatesPage = () => {
  const { token } = useAuth();
  const location = useLocation();
  const profileDraft = location.state?.profileDraft || null;
  const [templates, setTemplates] = useState(FALLBACK_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/resume-builder/templates", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.templates?.length) {
          const merged = data.templates.map((t) => ({
            ...t,
            tagline: META_BY_ID[t.id]?.tagline || "ATS-friendly layout",
            badge: META_BY_ID[t.id]?.badge || "ATS",
            description: t.description || META_BY_ID[t.id]?.description || "",
          }));
          if (mounted) setTemplates(merged);
        }
      } catch (err) {
        if (mounted) setError("Could not load templates from server. Showing defaults.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (token) load();
    else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [token]);

  const cards = useMemo(() => templates, [templates]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold text-teal uppercase tracking-[0.14em]">
            Resume Builder
          </p>
          <h1 className="mt-1 text-3xl font-display font-semibold text-ink tracking-tight">
            Choose an ATS resume template
          </h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Preview how each layout looks, then select one. Your profile details stay the same
            when you switch templates later.
          </p>
        </div>
        <Link
          to="/student/profile"
          className="btn-secondary px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-sage bg-paper animate-pulse h-80" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((t) => {
            const active = hovered === t.id;
            return (
              <Link
                key={t.id}
                to={`/student/resume-builder/${t.id}`}
                state={profileDraft ? { profileDraft } : undefined}
                onMouseEnter={() => setHovered(t.id)}
                onMouseLeave={() => setHovered(null)}
                className={`group rounded-2xl overflow-hidden border bg-white transition duration-200 ${
                  active
                    ? "border-teal shadow-md ring-1 ring-teal/30 -translate-y-0.5"
                    : "border-sage shadow-xs hover:border-teal/50 hover:shadow-sm"
                }`}
              >
                <div className="relative bg-paper/80 px-4 pt-4 pb-3 border-b border-sage/70">
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-soft text-teal border border-teal/20">
                      {t.badge || "ATS"}
                    </span>
                  </div>
                  <div className="mx-auto w-[72%] max-w-[200px] drop-shadow-sm transition duration-200 group-hover:scale-[1.02]">
                    <TemplateThumbnail templateId={t.id} />
                  </div>
                  <p className="mt-3 text-center text-[10px] font-medium text-ink-muted tracking-wide">
                    Visual preview · ATS layout
                  </p>
                </div>

                <div className="p-4 space-y-2">
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink tracking-tight group-hover:text-teal transition-colors">
                      {t.name}
                    </h2>
                    <p className="text-[11px] font-semibold text-teal/90 mt-0.5">{t.tagline}</p>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed min-h-[2.8rem]">
                    {t.description}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal">
                      Use this template
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                    {active && <CheckCircle2 className="w-4 h-4 text-teal" />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResumeTemplatesPage;
