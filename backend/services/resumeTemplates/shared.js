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

const educationLine = (s) => {
  const degreeDept = [s.degree, s.department].filter(Boolean).join(" – ");
  const school = s.instituteName || "";
  const year = s.batch ? String(s.batch) : "";
  const cgpa =
    s.cgpa !== undefined && s.cgpa !== null && s.cgpa !== "" ? `CGPA ${s.cgpa}` : "";
  return { degreeDept, school, year, cgpa };
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
  body { margin: 0; padding: 28px 32px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.4; }
  h1 { margin: 0 0 2px; font-size: 20pt; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
  .subtitle { margin: 0 0 8px; font-size: 11pt; color: #333; font-weight: 600; }
  .contact { margin: 0 0 14px; font-size: 9.5pt; color: #333; }
  h2 { margin: 14px 0 6px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1.5px solid #222; padding-bottom: 2px; }
  p { margin: 0 0 4px; }
  ul { margin: 2px 0 8px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .item-title { font-weight: 700; }
  .muted { color: #444; font-size: 9.5pt; }
  a { color: #0b3d4a; text-decoration: none; }
  .skill-row { margin: 0 0 3px; }
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
  bulletizeDescription,
  wrapDocument,
};
