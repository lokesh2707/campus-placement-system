const { escapeHtml } = require("./shared");
const { renderModernAtsProfessional } = require("./modernAtsProfessional");
const { renderModernMinimalist } = require("./modernMinimalist");
const { renderTechnicalDeveloper } = require("./technicalDeveloper");
const { renderCorporateExperienced } = require("./corporateExperienced");
const { renderFresherGraduate } = require("./fresherGraduate");

const TEMPLATES = [
  {
    id: "modern_ats_professional",
    name: "Modern ATS Professional",
    description:
      "Classic ATS-friendly layout with summary, categorized skills, experience, projects and education.",
  },
  {
    id: "modern_minimalist",
    name: "Modern Minimalist",
    description:
      "Clean minimalist layout with About Me, competencies, technical expertise and selected projects.",
  },
  {
    id: "technical_developer",
    name: "Technical Developer",
    description:
      "Technology-first layout highlighting programming skills, stack, projects and experience.",
  },
  {
    id: "corporate_experienced",
    name: "Corporate Experienced",
    description:
      "Corporate style emphasizing executive summary, detailed experience and key projects.",
  },
  {
    id: "fresher_graduate",
    name: "Fresher / Graduate",
    description:
      "Campus fresher layout with career objective, academic projects, internships and education.",
  },
];

/** Map legacy template IDs (from earlier builds) to the new set */
const LEGACY_TEMPLATE_MAP = {
  ats_professional: "modern_ats_professional",
  modern_graduate: "fresher_graduate",
  developer_portfolio: "technical_developer",
};

const listTemplates = () => TEMPLATES;

const resolveTemplateId = (id) => LEGACY_TEMPLATE_MAP[id] || id;

const isValidTemplateId = (id) => {
  const resolved = resolveTemplateId(id);
  return TEMPLATES.some((t) => t.id === resolved);
};

const renderResumeHtml = (templateId, snapshot) => {
  const id = resolveTemplateId(templateId);
  switch (id) {
    case "modern_ats_professional":
      return renderModernAtsProfessional(snapshot);
    case "modern_minimalist":
      return renderModernMinimalist(snapshot);
    case "technical_developer":
      return renderTechnicalDeveloper(snapshot);
    case "corporate_experienced":
      return renderCorporateExperienced(snapshot);
    case "fresher_graduate":
      return renderFresherGraduate(snapshot);
    default:
      throw new Error("Invalid resume template");
  }
};

module.exports = {
  TEMPLATES,
  listTemplates,
  isValidTemplateId,
  resolveTemplateId,
  renderResumeHtml,
  escapeHtml,
};
