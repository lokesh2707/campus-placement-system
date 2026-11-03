const {
  escapeHtml,
  categorizeSkills,
  deriveTitle,
  contactBits,
  educationLine,
  bulletizeDescription,
  wrapDocument,
} = require("./shared");

const renderModernMinimalist = (s) => {
  const cats = categorizeSkills(s.skills || []);
  const edu = educationLine(s);
  const contact = contactBits(s);
  const competencies = [
    cats.frontend.length ? "Frontend Development" : null,
    cats.backend.length ? "Backend Development" : null,
    "API Integration",
    cats.database.length ? "Database Design" : null,
    "Authentication",
    "Responsive UI",
  ].filter(Boolean);

  const experience = (s.experience || []).filter((e) => e.role && e.company);
  const projects = (s.projects || []).filter((p) => p.title);

  const extra = `
    h1 { text-transform: none; letter-spacing: -0.01em; font-size: 22pt; }
    h2 { border-bottom: 1px solid #999; font-weight: 600; letter-spacing: 0.12em; }
  `;

  const body = `
    <h1>${escapeHtml(s.name || "Your Full Name")}</h1>
    <p class="subtitle">${escapeHtml(deriveTitle(s).split("|")[0].trim() || "Full Stack Developer")}</p>
    <p class="contact">${contact.join(" | ")}</p>
    ${s.location ? `<p class="muted">Location: ${escapeHtml(s.location)}</p>` : ""}

    ${
      s.professionalSummary
        ? `<h2>About Me</h2><p>${escapeHtml(s.professionalSummary)}</p>`
        : ""
    }

    ${
      competencies.length
        ? `<h2>Core Competencies</h2><p>${competencies.map(escapeHtml).join(" | ")}</p>`
        : ""
    }

    <h2>Technical Expertise</h2>
    ${cats.languages.length ? `<p class="skill-row"><span class="skill-label">Programming:</span> ${cats.languages.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.frontend.length ? `<p class="skill-row"><span class="skill-label">Frontend:</span> ${cats.frontend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.backend.length ? `<p class="skill-row"><span class="skill-label">Backend:</span> ${cats.backend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.database.length ? `<p class="skill-row"><span class="skill-label">Database:</span> ${cats.database.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.tools.length || cats.other.length ? `<p class="skill-row"><span class="skill-label">Cloud & Tools:</span> ${[...cats.tools, ...cats.other].map(escapeHtml).join(", ")}</p>` : ""}

    ${
      experience.length
        ? `<h2>Professional Experience</h2>${experience
            .map((e) => {
              const bullets = bulletizeDescription(e.description)
                .map((b) => `<li>${escapeHtml(b)}</li>`)
                .join("");
              return `<div style="margin-bottom:8px">
                <p><span class="item-title">${escapeHtml(e.role)} – ${escapeHtml(e.company)}</span></p>
                <p class="muted">${escapeHtml(e.duration || "")}</p>
                ${bullets ? `<ul>${bullets}</ul>` : ""}
              </div>`;
            })
            .join("")}`
        : ""
    }

    ${
      projects.length
        ? `<h2>Selected Projects</h2>${projects
            .map((p) => {
              return `<div style="margin-bottom:8px">
                <p class="item-title">${escapeHtml(p.title)}</p>
                ${p.description ? `<p><span class="skill-label">Description:</span> ${escapeHtml(p.description)}</p>` : ""}
                ${(p.technologies || []).length ? `<p><span class="skill-label">Technologies:</span> ${p.technologies.map(escapeHtml).join(", ")}</p>` : ""}
                ${p.githubUrl ? `<p><span class="skill-label">GitHub:</span> <a href="${escapeHtml(p.githubUrl)}">${escapeHtml(p.githubUrl)}</a></p>` : ""}
              </div>`;
            })
            .join("")}`
        : ""
    }

    <h2>Education</h2>
    <p>${[edu.degreeDept, edu.school, edu.year, edu.cgpa].filter(Boolean).map(escapeHtml).join(" | ")}</p>
  `;

  return wrapDocument(s.name || "Resume", body, extra);
};

module.exports = { renderModernMinimalist };
