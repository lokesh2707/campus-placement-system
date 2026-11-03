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

const renderAtsProfessional = (s) => {
  const body = `
    <header>
      <h1>${escapeHtml(s.name || "Student")}</h1>
      <p class="contact">${contactLine(s)}</p>
    </header>
    ${sectionSummary(s)}
    ${sectionEducation(s)}
    ${sectionSkills(s)}
    ${sectionExperience(s)}
    ${sectionProjects(s)}
    ${sectionCertifications(s)}
  `;
  return wrapDocument(s.name || "Resume", body);
};

module.exports = { renderAtsProfessional, escapeHtml };
