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

const renderModernGraduate = (s) => {
  const extra = `
    h1 { color: #0f4c5c; }
    h2 { color: #0f4c5c; border-bottom-color: #0f4c5c; }
  `;
  const body = `
    <header>
      <h1>${escapeHtml(s.name || "Student")}</h1>
      <p class="contact">${contactLine(s)}</p>
    </header>
    ${sectionSummary(s)}
    ${sectionEducation(s)}
    ${sectionProjects(s)}
    ${sectionCertifications(s)}
    ${sectionSkills(s)}
    ${sectionExperience(s)}
  `;
  return wrapDocument(s.name || "Resume", body, extra);
};

module.exports = { renderModernGraduate };
