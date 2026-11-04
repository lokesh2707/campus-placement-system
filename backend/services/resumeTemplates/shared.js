const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const FRONTEND_HINTS = [
  "react",
  "next",
  "html",
  "css",
  "tailwind",
  "vue",
  "angular",
  "javascript",
  "typescript",
  "jquery",
];
const BACKEND_HINTS = [
  "node",
  "express",
  "spring",
  "django",
  "flask",
  "fastapi",
  "nest",
  "graphql",
];
const DB_HINTS = ["mongo", "mysql", "postgres", "sql", "redis", "oracle", "sqlite"];
const LANG_HINTS = ["java", "python", "javascript", "typescript", "c++", "c#", "go", "kotlin", "sql"];
const TOOL_HINTS = ["git", "github", "docker", "jenkins", "postman", "aws", "azure", "vscode", "linux"];

const categorizeSkills = (skills = []) => {
  const list = skills.map((s) => String(s).trim()).filter(Boolean);
  const buckets = {
    languages: [],
    frontend: [],
    backend: [],
    database: [],
    tools: [],
    other: [],
  };
  list.forEach((skill) => {
    const lower = skill.toLowerCase();
    if (LANG_HINTS.some((h) => lower.includes(h))) buckets.languages.push(skill);
    else if (FRONTEND_HINTS.some((h) => lower.includes(h))) buckets.frontend.push(skill);
    else if (BACKEND_HINTS.some((h) => lower.includes(h))) buckets.backend.push(skill);
    else if (DB_HINTS.some((h) => lower.includes(h))) buckets.database.push(skill);
    else if (TOOL_HINTS.some((h) => lower.includes(h))) buckets.tools.push(skill);
    else buckets.other.push(skill);
  });
  return buckets;
};

const deriveTitle = (s) => {
  if (s.headline) return s.headline;
  const skills = (s.skills || []).map((x) => String(x).toLowerCase());
  const hasFrontend = skills.some((x) => FRONTEND_HINTS.some((h) => x.includes(h)));
  const hasBackend = skills.some((x) => BACKEND_HINTS.some((h) => x.includes(h)));
  if (hasFrontend && hasBackend) return "Software Developer | Full Stack Developer";
  if (hasBackend) return "Software Engineer | Backend Developer";
  if (hasFrontend) return "Software Developer | Frontend Developer";
  return "Software Developer | Entry-Level Software Engineer";
};

const contactBits = (s, { withLabels = false } = {}) => {
  const bits = [];
  if (s.email) bits.push(withLabels ? `Email: ${escapeHtml(s.email)}` : escapeHtml(s.email));
  if (s.phone) bits.push(withLabels ? `Phone: ${escapeHtml(s.phone)}` : escapeHtml(s.phone));
  if (s.linkedinUrl) {
    bits.push(
      withLabels
        ? `LinkedIn: <a href="${escapeHtml(s.linkedinUrl)}">${escapeHtml(s.linkedinUrl)}</a>`
        : `<a href="${escapeHtml(s.linkedinUrl)}">LinkedIn</a>`
    );
  }
  if (s.githubUrl) {
    bits.push(
      withLabels
        ? `GitHub: <a href="${escapeHtml(s.githubUrl)}">${escapeHtml(s.githubUrl)}</a>`
        : `<a href="${escapeHtml(s.githubUrl)}">GitHub</a>`
    );
  }
  if (s.portfolioUrl) {
    bits.push(
      withLabels
        ? `Portfolio: <a href="${escapeHtml(s.portfolioUrl)}">${escapeHtml(s.portfolioUrl)}</a>`
        : `<a href="${escapeHtml(s.portfolioUrl)}">Portfolio</a>`
    );
  }
  if (s.location) bits.push(withLabels ? `Location: ${escapeHtml(s.location)}` : escapeHtml(s.location));
  return bits;
};

const collegeYearRange = (s) => {
  const start = s.collegeStartYear ? String(s.collegeStartYear) : "";
  const end = s.batch ? String(s.batch) : s.graduationYear ? String(s.graduationYear) : "";
  if (start && end) return `${start} – ${end}`;
  return end || start || "";
};

const educationLine = (s) => {
  const degreeDept = [s.degree, s.department].filter(Boolean).join(" – ");
  const school = s.instituteName || s.educationInstitution || "";
  const year = collegeYearRange(s);
  const cgpa =
    s.cgpa !== undefined && s.cgpa !== null && s.cgpa !== "" ? `CGPA ${s.cgpa}` : "";
  return { degreeDept, school, year, cgpa };
};

/** Multi-level education entries for resume Education section */
const educationBlocks = (s) => {
  const blocks = [];
  const college = s.instituteName || s.educationInstitution || "";
  const collegeDuration = collegeYearRange(s);
  const degreeDept = [s.degree, s.department].filter(Boolean).join(" – ");
  const cgpa =
    s.cgpa !== undefined && s.cgpa !== null && s.cgpa !== "" ? `CGPA ${s.cgpa}` : "";

  if (degreeDept || college) {
    blocks.push({
      title: degreeDept || "Undergraduate",
      school: college,
      duration: collegeDuration,
      detail: cgpa,
    });
  }

  if (s.intermediateName || (s.twelfthPercentage != null && s.twelfthPercentage !== "")) {
    blocks.push({
      title: "Higher Secondary (12th)",
      school: s.intermediateName || "",
      duration: s.intermediateDuration || "",
      detail:
        s.twelfthPercentage != null && s.twelfthPercentage !== ""
          ? `${s.twelfthPercentage}%`
          : "",
    });
  }

  if (s.schoolName || (s.tenthPercentage != null && s.tenthPercentage !== "")) {
    blocks.push({
      title: "Secondary (10th)",
      school: s.schoolName || "",
      duration: s.schoolDuration || "",
      detail:
        s.tenthPercentage != null && s.tenthPercentage !== ""
          ? `${s.tenthPercentage}%`
          : "",
    });
  }

  return blocks;
};

const renderEducationHtml = (s) => {
  const blocks = educationBlocks(s);
  if (!blocks.length) return "";
  return `<h2>Education</h2>${blocks
    .map((b) => {
      const meta = [b.school, b.duration, b.detail].filter(Boolean).map(escapeHtml).join(" | ");
      return `<div style="margin-bottom:6px">
        <p class="item-title">${escapeHtml(b.title)}</p>
        ${meta ? `<p class="muted">${meta}</p>` : ""}
      </div>`;
    })
    .join("")}`;
};

const bulletizeDescription = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/\n|(?<=\.)\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 8);
  return parts.length ? parts.slice(0, 6) : [raw];
};

const baseStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 8px 18px 14px; font-family: 'Times New Roman', Times, serif; color: #111; font-size: 11pt; line-height: 1.35; }
  h1 { margin: 0 0 2px; font-size: 20pt; font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase; font-family: 'Times New Roman', Times, serif; }
  .subtitle { margin: 0 0 4px; font-size: 11pt; color: #333; font-weight: 600; }
  .contact { margin: 0 0 8px; font-size: 10pt; color: #333; }
  h2 { margin: 10px 0 4px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1.5px solid #222; padding-bottom: 2px; font-family: 'Times New Roman', Times, serif; }
  p { margin: 0 0 3px; }
  ul { margin: 2px 0 6px; padding-left: 18px; }
  li { margin-bottom: 2px; }
  .item-title { font-weight: 700; }
  .muted { color: #444; font-size: 10pt; }
  a { color: #0b3d4a; text-decoration: none; }
  .skill-row { margin: 0 0 2px; }
  .skill-label { font-weight: 700; }
`;

const wrapDocument = (title, bodyHtml, extraCss = "") => `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>${baseStyles}${extraCss}</style></head>
<body>${bodyHtml}</body></html>`;

module.exports = {
  escapeHtml,
  categorizeSkills,
  deriveTitle,
  contactBits,
  educationLine,
  educationBlocks,
  renderEducationHtml,
  bulletizeDescription,
  wrapDocument,
};
