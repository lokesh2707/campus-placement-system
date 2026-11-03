import React from "react";

const FRONTEND_HINTS = ["react", "next", "html", "css", "tailwind", "vue", "angular", "javascript", "typescript"];
const BACKEND_HINTS = ["node", "express", "spring", "django", "flask", "fastapi", "nest"];
const DB_HINTS = ["mongo", "mysql", "postgres", "sql", "redis"];
const LANG_HINTS = ["java", "python", "javascript", "typescript", "c++", "c#", "go", "sql"];
const TOOL_HINTS = ["git", "github", "docker", "jenkins", "postman", "aws", "vscode"];

const categorizeSkills = (skills = []) => {
  const buckets = { languages: [], frontend: [], backend: [], database: [], tools: [], other: [] };
  skills.filter(Boolean).forEach((skill) => {
    const lower = String(skill).toLowerCase();
    if (LANG_HINTS.some((h) => lower.includes(h))) buckets.languages.push(skill);
    else if (FRONTEND_HINTS.some((h) => lower.includes(h))) buckets.frontend.push(skill);
    else if (BACKEND_HINTS.some((h) => lower.includes(h))) buckets.backend.push(skill);
    else if (DB_HINTS.some((h) => lower.includes(h))) buckets.database.push(skill);
    else if (TOOL_HINTS.some((h) => lower.includes(h))) buckets.tools.push(skill);
    else buckets.other.push(skill);
  });
  return buckets;
};

const deriveTitle = (data) => {
  const skills = (data.skills || []).map((x) => String(x).toLowerCase());
  const hasFrontend = skills.some((x) => FRONTEND_HINTS.some((h) => x.includes(h)));
  const hasBackend = skills.some((x) => BACKEND_HINTS.some((h) => x.includes(h)));
  if (hasFrontend && hasBackend) return "Software Developer | Full Stack Developer";
  if (hasBackend) return "Software Engineer | Backend Developer";
  if (hasFrontend) return "Software Developer | Frontend Developer";
  return "Graduate Software Developer | Entry-Level Software Engineer";
};

const contactLine = (data, withLabels = false) => {
  const parts = [];
  if (data.email) parts.push(withLabels ? `Email: ${data.email}` : data.email);
  if (data.phone) parts.push(withLabels ? `Phone: ${data.phone}` : data.phone);
  if (data.linkedinUrl) parts.push(withLabels ? `LinkedIn: ${data.linkedinUrl}` : "LinkedIn");
  if (data.githubUrl) parts.push(withLabels ? `GitHub: ${data.githubUrl}` : "GitHub");
  if (data.portfolioUrl) parts.push(withLabels ? `Portfolio: ${data.portfolioUrl}` : "Portfolio");
  return parts;
};

const Section = ({ title, children }) => (
  <section className="mt-3">
    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] border-b border-ink/50 pb-1 mb-2 text-ink">
      {title}
    </h2>
    {children}
  </section>
);

const SkillRows = ({ cats }) => (
  <>
    {cats.languages.length > 0 && (
      <p className="text-xs text-ink mb-0.5">
        <span className="font-semibold">Languages: </span>
        {cats.languages.join(", ")}
      </p>
    )}
    {cats.frontend.length > 0 && (
      <p className="text-xs text-ink mb-0.5">
        <span className="font-semibold">Frontend: </span>
        {cats.frontend.join(", ")}
      </p>
    )}
    {cats.backend.length > 0 && (
      <p className="text-xs text-ink mb-0.5">
        <span className="font-semibold">Backend: </span>
        {cats.backend.join(", ")}
      </p>
    )}
    {cats.database.length > 0 && (
      <p className="text-xs text-ink mb-0.5">
        <span className="font-semibold">Database: </span>
        {cats.database.join(", ")}
      </p>
    )}
    {(cats.tools.length > 0 || cats.other.length > 0) && (
      <p className="text-xs text-ink mb-0.5">
        <span className="font-semibold">Tools: </span>
        {[...cats.tools, ...cats.other].join(", ")}
      </p>
    )}
  </>
);

const EducationBlock = ({ data }) =>
  (data.degree || data.department || data.batch) && (
    <Section title="Education">
      <p className="text-sm font-semibold text-ink">
        {[data.degree, data.department].filter(Boolean).join(" – ")}
      </p>
      <p className="text-xs text-ink-muted">
        {[
          data.instituteName,
          data.batch,
          data.cgpa !== undefined && data.cgpa !== null && data.cgpa !== ""
            ? `CGPA ${data.cgpa}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")}
      </p>
    </Section>
  );

const ResumePreview = ({ data, templateId = "modern_ats_professional" }) => {
  const skills = Array.isArray(data.skills) ? data.skills.filter(Boolean) : [];
  const cats = categorizeSkills(skills);
  const projects = Array.isArray(data.projects) ? data.projects.filter((p) => p.title) : [];
  const experience = Array.isArray(data.experience)
    ? data.experience.filter((e) => e.role && e.company)
    : [];
  const certifications = Array.isArray(data.certifications)
    ? data.certifications.filter((c) => c.title)
    : [];

  const id = {
    ats_professional: "modern_ats_professional",
    modern_graduate: "fresher_graduate",
    developer_portfolio: "technical_developer",
  }[templateId] || templateId;

  const title = deriveTitle(data);

  let body;
  if (id === "modern_minimalist") {
    body = (
      <>
        {data.professionalSummary && (
          <Section title="About Me">
            <p className="text-xs text-ink leading-relaxed">{data.professionalSummary}</p>
          </Section>
        )}
        <Section title="Core Competencies">
          <p className="text-xs text-ink">
            {[
              cats.frontend.length ? "Frontend Development" : null,
              cats.backend.length ? "Backend Development" : null,
              "API Integration",
              cats.database.length ? "Database Design" : null,
              "Responsive UI",
            ]
              .filter(Boolean)
              .join(" | ")}
          </p>
        </Section>
        {skills.length > 0 && (
          <Section title="Technical Expertise">
            <SkillRows cats={cats} />
          </Section>
        )}
        {experience.length > 0 && (
          <Section title="Professional Experience">
            {experience.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">{e.role} – {e.company}</p>
                {e.duration && <p className="text-[11px] text-ink-muted">{e.duration}</p>}
                {e.description && <p className="text-xs mt-0.5">{e.description}</p>}
              </div>
            ))}
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Selected Projects">
            {projects.map((p, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">{p.title}</p>
                {p.description && (
                  <p className="text-xs">
                    <span className="font-semibold">Description: </span>
                    {p.description}
                  </p>
                )}
                {p.technologies?.length > 0 && (
                  <p className="text-xs text-ink-muted">Technologies: {p.technologies.join(", ")}</p>
                )}
              </div>
            ))}
          </Section>
        )}
        <EducationBlock data={data} />
      </>
    );
  } else if (id === "technical_developer") {
    body = (
      <>
        {data.professionalSummary && (
          <Section title="Professional Profile">
            <p className="text-xs leading-relaxed">{data.professionalSummary}</p>
          </Section>
        )}
        {cats.languages.length > 0 && (
          <Section title="Programming Skills">
            <p className="text-xs font-semibold">{cats.languages.join(" | ")}</p>
          </Section>
        )}
        {skills.length > 0 && (
          <Section title="Technology Stack">
            <SkillRows cats={cats} />
          </Section>
        )}
        {experience.length > 0 && (
          <Section title="Professional Experience">
            {experience.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">
                  {e.role} – {e.company}
                </p>
                {e.description && <p className="text-xs mt-0.5">{e.description}</p>}
              </div>
            ))}
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Technical Projects">
            {projects.map((p, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">{p.title}</p>
                {p.description && (
                  <p className="text-xs">
                    <span className="font-semibold">Solution: </span>
                    {p.description}
                  </p>
                )}
                {p.technologies?.length > 0 && (
                  <p className="text-xs text-ink-muted">Technologies: {p.technologies.join(", ")}</p>
                )}
              </div>
            ))}
          </Section>
        )}
        <EducationBlock data={data} />
        {certifications.length > 0 && (
          <Section title="Certifications">
            <ul className="text-xs list-disc pl-4">
              {certifications.map((c, i) => (
                <li key={i}>{c.title}</li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  } else if (id === "corporate_experienced") {
    body = (
      <>
        {data.professionalSummary && (
          <Section title="Executive Summary">
            <p className="text-xs leading-relaxed">{data.professionalSummary}</p>
          </Section>
        )}
        {experience.length > 0 && (
          <Section title="Professional Experience">
            {experience.map((e, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-semibold">
                  {e.company} – {e.role}
                </p>
                {e.duration && <p className="text-[11px] text-ink-muted">{e.duration}</p>}
                <p className="text-[11px] font-semibold mt-1">Responsibilities:</p>
                {e.description && <p className="text-xs">{e.description}</p>}
              </div>
            ))}
          </Section>
        )}
        {skills.length > 0 && (
          <Section title="Technical Skills">
            <p className="text-xs">{skills.join(" | ")}</p>
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Key Projects">
            {projects.map((p, i) => (
              <p key={i} className="text-xs mb-1">
                <span className="font-semibold">{p.title}</span>
                {p.technologies?.length ? ` | ${p.technologies.join(", ")}` : ""}
                {p.description ? ` | ${p.description.slice(0, 120)}` : ""}
              </p>
            ))}
          </Section>
        )}
        <EducationBlock data={data} />
        {certifications.length > 0 && (
          <Section title="Certifications">
            <ul className="text-xs list-disc pl-4">
              {certifications.map((c, i) => (
                <li key={i}>{c.title}</li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  } else if (id === "fresher_graduate") {
    body = (
      <>
        <Section title="Career Objective">
          <p className="text-xs leading-relaxed">
            {data.professionalSummary ||
              "Computer Science graduate seeking an entry-level Software Developer opportunity to apply programming knowledge and practical development experience."}
          </p>
        </Section>
        {skills.length > 0 && (
          <Section title="Technical Skills">
            <SkillRows cats={cats} />
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Academic Projects">
            {projects.map((p, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">
                  Project {i + 1} – {p.title}
                </p>
                {p.description && <p className="text-xs mt-0.5">{p.description}</p>}
                {p.technologies?.length > 0 && (
                  <p className="text-[11px] text-ink-muted">Used {p.technologies.join(", ")}</p>
                )}
              </div>
            ))}
          </Section>
        )}
        {experience.length > 0 && (
          <Section title="Internships">
            {experience.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">
                  {e.role} – {e.company}
                </p>
                {e.duration && <p className="text-[11px] text-ink-muted">{e.duration}</p>}
                {e.description && <p className="text-xs mt-0.5">{e.description}</p>}
              </div>
            ))}
          </Section>
        )}
        <EducationBlock data={data} />
        {certifications.length > 0 && (
          <Section title="Certifications">
            <ul className="text-xs list-disc pl-4">
              {certifications.map((c, i) => (
                <li key={i}>
                  {c.title}
                  {c.issuingOrganization ? ` – ${c.issuingOrganization}` : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  } else {
    // modern_ats_professional (default)
    body = (
      <>
        {data.professionalSummary && (
          <Section title="Professional Summary">
            <p className="text-xs leading-relaxed">{data.professionalSummary}</p>
          </Section>
        )}
        {skills.length > 0 && (
          <Section title="Technical Skills">
            <SkillRows cats={cats} />
          </Section>
        )}
        {experience.length > 0 && (
          <Section title="Work Experience">
            {experience.map((e, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">
                  {e.role} | {e.company}
                </p>
                {e.duration && <p className="text-[11px] text-ink-muted">{e.duration}</p>}
                {e.description && <p className="text-xs mt-0.5">{e.description}</p>}
              </div>
            ))}
          </Section>
        )}
        {projects.length > 0 && (
          <Section title="Projects">
            {projects.map((p, i) => (
              <div key={i} className="mb-2">
                <p className="text-sm font-semibold">
                  {p.title}
                  {p.technologies?.length ? ` | ${p.technologies.join(", ")}` : ""}
                </p>
                {p.description && <p className="text-xs mt-0.5">{p.description}</p>}
              </div>
            ))}
          </Section>
        )}
        <EducationBlock data={data} />
        {certifications.length > 0 && (
          <Section title="Certifications">
            <ul className="text-xs list-disc pl-4">
              {certifications.map((c, i) => (
                <li key={i}>
                  {c.title}
                  {c.issuingOrganization ? ` – ${c.issuingOrganization}` : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  }

  const subtitle =
    id === "fresher_graduate"
      ? "Graduate Software Developer | Entry-Level Software Engineer"
      : id === "corporate_experienced"
        ? "Software Engineer / Software Developer"
        : id === "modern_minimalist"
          ? title.split("|")[0].trim()
          : title;

  return (
    <div className="bg-white text-ink shadow-sm border border-sage rounded-xl p-6 min-h-[640px] font-sans">
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-wide uppercase text-ink">
          {data.name || "Your Full Name"}
        </h1>
        <p className="text-xs font-semibold text-ink-muted mt-0.5">{subtitle}</p>
        <p className="text-[11px] text-ink-muted mt-1">
          {[...contactLine(data, id === "modern_ats_professional"), data.location].filter(Boolean).join(" | ")}
        </p>
      </header>
      {body}
    </div>
  );
};

export default ResumePreview;
