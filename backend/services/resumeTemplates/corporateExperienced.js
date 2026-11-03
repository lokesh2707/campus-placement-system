const {
  escapeHtml,
  categorizeSkills,
  contactBits,
  educationLine,
  bulletizeDescription,
  wrapDocument,
} = require("./shared");

const renderCorporateExperienced = (s) => {
  const cats = categorizeSkills(s.skills || []);
  const edu = educationLine(s);
  const contact = contactBits(s);
  const experience = (s.experience || []).filter((e) => e.role && e.company);
  const projects = (s.projects || []).filter((p) => p.title);
  const certs = (s.certifications || []).filter((c) => c.title);
  const allSkills = [
    ...cats.languages,
    ...cats.frontend,
    ...cats.backend,
    ...cats.database,
    ...cats.tools,
    ...cats.other,
  ];

  const extra = `
    h1 { font-size: 18pt; }
    h2 { color: #1a1a1a; border-bottom-width: 2px; }
  `;

  const body = `
    <h1>${escapeHtml(s.name || "Your Full Name")}</h1>
    <p class="subtitle">Software Engineer / Software Developer</p>
    <p class="contact">${[...contact, s.location ? escapeHtml(s.location) : ""].filter(Boolean).join(" | ")}</p>

    ${
      s.professionalSummary
        ? `<h2>Executive Summary</h2><p>${escapeHtml(s.professionalSummary)}</p>`
        : ""
    }

    ${
      experience.length
        ? `<h2>Professional Experience</h2>${experience
            .map((e) => {
              const bullets = bulletizeDescription(e.description)
                .map((b) => `<li>${escapeHtml(b)}</li>`)
                .join("");
              return `<div style="margin-bottom:10px">
                <p class="item-title">${escapeHtml(e.company)} – ${escapeHtml(e.role)}</p>
                <p class="muted">${escapeHtml(e.duration || "")}</p>
                <p class="skill-label">Responsibilities:</p>
                ${bullets ? `<ul>${bullets}</ul>` : "<p class=\"muted\">—</p>"}
              </div>`;
            })
            .join("")}`
        : ""
    }

    ${
      allSkills.length
        ? `<h2>Technical Skills</h2><p>${allSkills.map(escapeHtml).join(" | ")}</p>`
        : ""
    }

    ${
      projects.length
        ? `<h2>Key Projects</h2>${projects
            .map((p) => {
              const tech = (p.technologies || []).map(escapeHtml).join(", ");
              return `<p><span class="item-title">${escapeHtml(p.title)}</span>${tech ? ` | ${tech}` : ""}${p.description ? ` | ${escapeHtml(p.description.slice(0, 180))}` : ""}</p>`;
            })
            .join("")}`
        : ""
    }

    <h2>Education</h2>
    <p>${[edu.degreeDept, edu.school, edu.year].filter(Boolean).map(escapeHtml).join(" | ")}</p>

    ${
      certs.length
        ? `<h2>Certifications</h2><ul>${certs
            .map((c) => `<li>${escapeHtml(c.title)}</li>`)
            .join("")}</ul>`
        : ""
    }
  `;

  return wrapDocument(s.name || "Resume", body, extra);
};

module.exports = { renderCorporateExperienced };
