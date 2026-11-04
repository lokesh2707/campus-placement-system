const {
  escapeHtml,
  categorizeSkills,
  deriveTitle,
  contactBits,
  renderEducationHtml,
  bulletizeDescription,
  wrapDocument,
} = require("./shared");

const renderTechnicalDeveloper = (s) => {
  const cats = categorizeSkills(s.skills || []);
  const contact = contactBits(s);
  const experience = (s.experience || []).filter((e) => e.role && e.company);
  const projects = (s.projects || []).filter((p) => p.title);
  const certs = (s.certifications || []).filter((c) => c.title);

  const extra = `
    h1 { font-family: Consolas, 'Courier New', monospace; text-transform: none; font-size: 18pt; }
    h2 { border-bottom: 2px solid #111; }
  `;

  const body = `
    <h1>${escapeHtml(s.name || "Your Full Name")}</h1>
    <p class="subtitle">${escapeHtml(deriveTitle(s))}</p>
    <p class="contact">${contact.join(" | ")}</p>

    ${
      s.professionalSummary
        ? `<h2>Professional Profile</h2><p>${escapeHtml(s.professionalSummary)}</p>`
        : ""
    }

    ${
      cats.languages.length
        ? `<h2>Programming Skills</h2><p>${cats.languages.map(escapeHtml).join(" | ")}</p>`
        : ""
    }

    <h2>Technology Stack</h2>
    ${cats.frontend.length ? `<p class="skill-row"><span class="skill-label">Frontend:</span> ${cats.frontend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.backend.length ? `<p class="skill-row"><span class="skill-label">Backend:</span> ${cats.backend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.database.length ? `<p class="skill-row"><span class="skill-label">Database:</span> ${cats.database.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.tools.length ? `<p class="skill-row"><span class="skill-label">DevOps / Tools:</span> ${cats.tools.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.other.length ? `<p class="skill-row"><span class="skill-label">Other:</span> ${cats.other.map(escapeHtml).join(", ")}</p>` : ""}

    ${
      experience.length
        ? `<h2>Professional Experience</h2>${experience
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

    ${
      projects.length
        ? `<h2>Technical Projects</h2>${projects
            .map((p) => {
              const bullets = bulletizeDescription(p.description);
              return `<div style="margin-bottom:8px">
                <p class="item-title">${escapeHtml(p.title)}</p>
                ${bullets[0] ? `<p><span class="skill-label">Solution:</span> ${escapeHtml(bullets[0])}</p>` : ""}
                ${(p.technologies || []).length ? `<p><span class="skill-label">Technologies:</span> ${p.technologies.map(escapeHtml).join(", ")}</p>` : ""}
                ${bullets.slice(1).length ? `<p><span class="skill-label">Responsibilities:</span></p><ul>${bullets.slice(1).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
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

module.exports = { renderTechnicalDeveloper };
