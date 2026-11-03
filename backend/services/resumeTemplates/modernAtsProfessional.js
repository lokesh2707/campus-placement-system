const {
  escapeHtml,
  categorizeSkills,
  deriveTitle,
  contactBits,
  educationLine,
  bulletizeDescription,
  wrapDocument,
} = require("./shared");

const renderModernAtsProfessional = (s) => {
  const cats = categorizeSkills(s.skills || []);
  const edu = educationLine(s);
  const contact = contactBits(s, { withLabels: true });
  const location = s.location || "India";

  const skillsHtml = `
    <h2>Technical Skills</h2>
    ${cats.languages.length ? `<p class="skill-row"><span class="skill-label">Languages:</span> ${cats.languages.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.frontend.length ? `<p class="skill-row"><span class="skill-label">Frontend:</span> ${cats.frontend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.backend.length ? `<p class="skill-row"><span class="skill-label">Backend:</span> ${cats.backend.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.database.length ? `<p class="skill-row"><span class="skill-label">Database:</span> ${cats.database.map(escapeHtml).join(", ")}</p>` : ""}
    ${cats.tools.length || cats.other.length ? `<p class="skill-row"><span class="skill-label">Tools:</span> ${[...cats.tools, ...cats.other].map(escapeHtml).join(", ")}</p>` : ""}
  `;

  const experience = (s.experience || []).filter((e) => e.role && e.company);
  const experienceHtml = experience.length
    ? `<h2>Work Experience</h2>${experience
        .map((e) => {
          const bullets = bulletizeDescription(e.description)
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join("");
          return `<div style="margin-bottom:8px">
            <p><span class="item-title">${escapeHtml(e.role)} | ${escapeHtml(e.company)}</span></p>
            <p class="muted">${escapeHtml(e.duration || "")}</p>
            ${bullets ? `<ul>${bullets}</ul>` : ""}
          </div>`;
        })
        .join("")}`
    : "";

  const projects = (s.projects || []).filter((p) => p.title);
  const projectsHtml = projects.length
    ? `<h2>Projects</h2>${projects
        .map((p) => {
          const tech = (p.technologies || []).map(escapeHtml).join(", ");
          const bullets = bulletizeDescription(p.description)
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join("");
          return `<div style="margin-bottom:8px">
            <p><span class="item-title">${escapeHtml(p.title)}</span>${tech ? ` | ${tech}` : ""}</p>
            ${bullets ? `<ul>${bullets}</ul>` : ""}
          </div>`;
        })
        .join("")}`
    : "";

  const certs = (s.certifications || []).filter((c) => c.title);
  const certsHtml = certs.length
    ? `<h2>Certifications</h2><ul>${certs
        .map(
          (c) =>
            `<li>${escapeHtml(c.title)}${c.issuingOrganization ? ` – ${escapeHtml(c.issuingOrganization)}` : ""}</li>`
        )
        .join("")}</ul>`
    : "";

  const body = `
    <h1>${escapeHtml(s.name || "Your Full Name")}</h1>
    <p class="subtitle">${escapeHtml(deriveTitle(s))}</p>
    <p class="contact">${[...contact, `Location: ${escapeHtml(location)}`].join(" | ")}</p>
    ${
      s.professionalSummary
        ? `<h2>Professional Summary</h2><p>${escapeHtml(s.professionalSummary)}</p>`
        : ""
    }
    ${skillsHtml}
    ${experienceHtml}
    ${projectsHtml}
    <h2>Education</h2>
    <p><span class="item-title">${escapeHtml(edu.degreeDept || "Degree")}</span>${edu.school ? ` – ${escapeHtml(edu.school)}` : ""}</p>
    <p class="muted">${[edu.year, edu.cgpa].filter(Boolean).map(escapeHtml).join(" | ")}</p>
    ${certsHtml}
  `;

  return wrapDocument(s.name || "Resume", body);
};

module.exports = { renderModernAtsProfessional };
