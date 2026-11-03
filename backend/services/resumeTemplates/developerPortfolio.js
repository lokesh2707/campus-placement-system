const {
  escapeHtml,
  contactLine,
  sectionSummary,
  sectionEducation,
  sectionSkills,
  sectionProjects,
  sectionExperience,
  sectionCertifications,
  wrapDocument,
} = require("./shared");

const renderDeveloperPortfolio = (s) => {
  const extra = `
    body { font-family: 'Segoe UI', Tahoma, sans-serif; }
    h1 { letter-spacing: -0.02em; }
    h2 { border-bottom: 2px solid #1a1a1a; }
    .skills li { font-weight: 600; }
  `;
  const body = `
    <header>
      <h1>${escapeHtml(s.name || "Student")}</h1>
      <p class="contact">${contactLine(s)}</p>
    </header>
    ${sectionSummary(s)}
    ${sectionSkills(s)}
    ${sectionProjects(s)}
    ${sectionExperience(s)}
    ${sectionEducation(s)}
    ${sectionCertifications(s)}
  `;
  return wrapDocument(s.name || "Resume", body, extra);
};

module.exports = { renderDeveloperPortfolio };
