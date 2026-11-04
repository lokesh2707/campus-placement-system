const {
  escapeHtml,
  categorizeSkills,
  contactBits,
  renderEducationHtml,
  bulletizeDescription,
  wrapDocument,
} = require("./shared");

const renderFresherGraduate = (s) => {
  const cats = categorizeSkills(s.skills || []);
  const contact = contactBits(s);
  const projects = (s.projects || []).filter((p) => p.title);
  const internships = (s.experience || []).filter((e) => e.role && e.company);
  const certs = (s.certifications || []).filter((c) => c.title);

  const objective =
    s.professionalSummary ||
    `Computer Science graduate seeking an entry-level Software Developer opportunity to apply programming knowledge, problem-solving skills and practical development experience to build reliable software applications.`;

  const extra = `
    h1 { font-size: 19pt; }
    .subtitle { font-weight: 500; }
  `;

  const body = `
    <h1>${escapeHtml(s.name || "Your Full Name")}</h1>
    <p class="subtitle">Graduate Software Developer | Entry-Level Software Engineer</p>
    <p class="contact">${[...contact, s.location ? escapeHtml(s.location) : ""].filter(Boolean).join(" | ")}</p>

    <h2>Career Objective</h2>
    <p>${escapeHtml(objective)}</p>

    <h2>Technical Skills</h2>
    ${cats.languages.length ? `<p class="skill-row"><span class="skill-label">Programming:</span> ${cats.languages.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.frontend.length ? `<p class="skill-row"><span class="skill-label">Frontend:</span> ${cats.frontend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.backend.length ? `<p class="skill-row"><span class="skill-label">Backend:</span> ${cats.backend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.database.length ? `<p class="skill-row"><span class="skill-label">Database:</span> ${cats.database.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.tools.length || cats.other.length ? `<p class="skill-row"><span class="skill-label">Tools:</span> ${[...cats.tools, ...cats.other].map(escapeHtml).join(", ")}</p>` : ""}

    ${
      projects.length
        ? `<h2>Academic Projects</h2>${projects
            .map((p, idx) => {
              const bullets = bulletizeDescription(p.description)
                .map((b) => `<li>${escapeHtml(b)}</li>`)
                .join("");
              return `<div style="margin-bottom:8px">
                <p class="item-title">Project ${idx + 1} – ${escapeHtml(p.title)}</p>
                ${bullets ? `<ul>${bullets}</ul>` : ""}
                ${(p.technologies || []).length ? `<p class="muted">Used ${(p.technologies || []).map(escapeHtml).join(", ")}</p>` : ""}
                ${p.githubUrl ? `<p class="muted">GitHub: <a href="${escapeHtml(p.githubUrl)}">${escapeHtml(p.githubUrl)}</a></p>` : ""}
              </div>`;
            })
            .join("")}`
        : ""
    }

    ${
      internships.length
        ? `<h2>Internships</h2>${internships
            .map((e) => {
              const bullets = bulletizeDescription(e.description)
                .map((b) => `<li>${escapeHtml(b)}</li>`)
                .join("");
              return `<div style="margin-bottom:8px">
                <p class="item-title">${escapeHtml(e.role)} – ${escapeHtml(e.company)}</p>
                <p class="muted">${escapeHtml(e.duration || "")}</p>
                ${bullets ? `<ul>${bullets}</ul>` : ""}
              </div>`;
            })
            .join("")}`
        : ""
    }

    ${renderEducationHtml(s)}

    ${
      certs.length
        ? `<h2>Certifications</h2><ul>${certs
            .map(
              (c) =>
                `<li>${escapeHtml(c.title)}${c.issuingOrganization ? ` – ${escapeHtml(c.issuingOrganization)}` : ""}</li>`
            )
            .join("")}</ul>`
        : ""
    }
  `;

  return wrapDocument(s.name || "Resume", body, extra);
};

module.exports = { renderFresherGraduate };
