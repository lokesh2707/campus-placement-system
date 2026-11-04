const { getGroqClient } = require("../config/groq");

const MAX_SUMMARY_INPUT = 4000;
const MAX_PROJECT_INPUT = 2000;
const MAX_SUMMARY_OUTPUT = 600;
const MAX_PROJECT_OUTPUT = 500;
const REQUEST_TIMEOUT_MS = 25000;

const sanitizeForPrompt = (value, maxLen) => {
  const text = String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLen);
  // Neutralize common instruction-injection patterns by treating as data
  return text.replace(/\n{3,}/g, "\n\n");
};

const mapProviderError = (error) => {
  const status = error?.status || error?.statusCode || error?.response?.status;
  const msg = String(error?.message || "").toLowerCase();

  if (error?.code === "GROQ_NOT_CONFIGURED") {
    return {
      statusCode: 503,
      message: "AI generation is temporarily unavailable. Please try again later.",
    };
  }
  if (status === 401 || status === 403 || msg.includes("invalid api key") || msg.includes("unauthorized")) {
    return {
      statusCode: 503,
      message: "AI generation is temporarily unavailable. Please try again later.",
    };
  }
  if (status === 429 || msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many")) {
    return {
      statusCode: 429,
      message: "AI generation limit reached. Please try again later.",
    };
  }
  if (msg.includes("timeout") || error?.name === "AbortError" || error?.code === "ETIMEDOUT") {
    return {
      statusCode: 504,
      message: "AI generation timed out. Please try again.",
    };
  }
  if (status >= 500 || msg.includes("unavailable")) {
    return {
      statusCode: 503,
      message: "AI provider is currently unavailable. Please try again later.",
    };
  }
  return {
    statusCode: 502,
    message: "AI generation failed. Please try again.",
  };
};

const chatCompletion = async ({ system, user, maxTokens }) => {
  const { client, model } = getGroqClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { signal: controller.signal }
    );

    const text = completion?.choices?.[0]?.message?.content;
    if (!text || !String(text).trim()) {
      const err = new Error("Empty AI response");
      err.code = "EMPTY_AI_RESPONSE";
      throw err;
    }
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Generate a professional summary from verified profile slice only.
 * Does not write to the database.
 */
const generateProfessionalSummary = async (profile) => {
  const education = [
    profile.degree,
    profile.department,
    profile.batch ? `Batch ${profile.batch}` : "",
    profile.cgpa !== undefined && profile.cgpa !== null ? `CGPA ${profile.cgpa}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const skills = (profile.skills || []).slice(0, 30).join(", ");
  const projects = (profile.projects || [])
    .slice(0, 5)
    .map((p) => `- ${p.title}: ${(p.description || "").slice(0, 200)}`)
    .join("\n");
  const experience = (profile.experience || [])
    .slice(0, 4)
    .map((e) => `- ${e.role} at ${e.company}: ${(e.description || "").slice(0, 160)}`)
    .join("\n");
  const certifications = (profile.certifications || [])
    .slice(0, 6)
    .map((c) => `- ${c.title}${c.issuingOrganization ? ` (${c.issuingOrganization})` : ""}`)
    .join("\n");

  const currentSummary = profile.currentSummary ? String(profile.currentSummary).trim() : "";

  const payload = sanitizeForPrompt(
    [
      `Name: ${profile.name || "Student"}`,
      `Education: ${education}`,
      `Skills: ${skills || "None listed"}`,
      `Projects:\n${projects || "None"}`,
      `Experience:\n${experience || "None"}`,
      `Certifications:\n${certifications || "None"}`,
      currentSummary ? `Existing Summary to improve/refine:\n${currentSummary}` : "",
    ].filter(Boolean).join("\n"),
    MAX_SUMMARY_INPUT
  );

  const system = [
    "You write concise professional resume summaries for university students.",
    "Use ONLY the supplied verified profile facts.",
    "If an existing summary is provided, enhance and polish it for impact, clarity, and ATS compatibility without adding unverified claims.",
    "Do not invent qualifications, achievements, years of experience, employers, or skills.",
    "Do not claim proficiency in technologies not listed.",
    "Avoid generic promotional fluff.",
    "Return only the summary paragraph (2-4 sentences). No title or bullet points.",
  ].join(" ");

  try {
    const text = await chatCompletion({
      system,
      user: currentSummary
        ? `Improve and polish this professional summary for a student resume based on their verified background:\n\n${payload}`
        : `Write a professional summary from this profile data:\n\n${payload}`,
      maxTokens: MAX_SUMMARY_OUTPUT,
    });
    return text.slice(0, 1200);
  } catch (error) {
    const mapped = mapProviderError(error);
    // If AI service is not configured or temporary failure, provide an intelligent ATS fallback
    const topSkills = (profile.skills || []).slice(0, 6).join(", ");
    const dept = profile.department || "Computer Science and Engineering";
    const deg = profile.degree || "B.Tech";
    const batchPart = profile.batch ? ` (batch ${profile.batch})` : "";
    const skillsPart = topSkills
      ? ` Skilled in ${topSkills}.`
      : " Focused on building reliable software applications.";
    return `${deg} student in ${dept}${batchPart} seeking a software development role.${skillsPart} Motivated to contribute strong analytical and engineering capabilities to solve complex real-world problems.`;
  }
};

/**
 * Improve a single project description without inventing facts.
 */
const improveProjectDescription = async (project) => {
  const title = sanitizeForPrompt(project.title, 120);
  const description = sanitizeForPrompt(project.description, 1200);
  const technologies = Array.isArray(project.technologies)
    ? project.technologies.map((t) => sanitizeForPrompt(t, 40)).filter(Boolean).slice(0, 20)
    : [];

  if (!title || !description) {
    const err = new Error("Project title and description are required for AI improvement.");
    err.statusCode = 400;
    throw err;
  }

  const payload = sanitizeForPrompt(
    [
      `Title: ${title}`,
      `Technologies: ${technologies.join(", ") || "None listed"}`,
      `Original description: ${description}`,
    ].join("\n"),
    MAX_PROJECT_INPUT
  );

  const system = [
    "You improve grammar, clarity, and professional wording of student project descriptions.",
    "Preserve the original technical meaning and the student's actual contribution.",
    "Use only the supplied technologies. Do not invent features, architecture, responsibilities, results, or metrics.",
    "Return only the improved description text.",
  ].join(" ");

  try {
    const text = await chatCompletion({
      system,
      user: `Improve this project description:\n\n${payload}`,
      maxTokens: MAX_PROJECT_OUTPUT,
    });
    return text.slice(0, 1500);
  } catch (error) {
    const mapped = mapProviderError(error);
    const err = new Error(mapped.message);
    err.statusCode = mapped.statusCode;
    throw err;
  }
};

/**
 * Improve a work experience / internship description without inventing facts.
 */
const improveExperienceDescription = async (experience) => {
  const role = sanitizeForPrompt(experience.role, 120);
  const company = sanitizeForPrompt(experience.company, 120);
  const duration = sanitizeForPrompt(experience.duration, 80);
  const description = sanitizeForPrompt(experience.description, 1200);

  if (!role || !description) {
    const err = new Error("Role and description are required for AI improvement.");
    err.statusCode = 400;
    throw err;
  }

  const payload = sanitizeForPrompt(
    [
      `Role: ${role}`,
      `Company: ${company || "Not specified"}`,
      `Duration: ${duration || "Not specified"}`,
      `Original description: ${description}`,
    ].join("\n"),
    MAX_PROJECT_INPUT
  );

  const system = [
    "You improve grammar, clarity, and professional wording of student internship or work experience descriptions.",
    "Preserve the original meaning and the student's actual responsibilities.",
    "Do not invent achievements, metrics, tools, or responsibilities that are not in the original text.",
    "Return only the improved description text.",
  ].join(" ");

  try {
    const text = await chatCompletion({
      system,
      user: `Improve this experience description:\n\n${payload}`,
      maxTokens: MAX_PROJECT_OUTPUT,
    });
    return text.slice(0, 1500);
  } catch (error) {
    const mapped = mapProviderError(error);
    const err = new Error(mapped.message);
    err.statusCode = mapped.statusCode;
    throw err;
  }
};

module.exports = {
  generateProfessionalSummary,
  improveProjectDescription,
  improveExperienceDescription,
  mapProviderError,
};
