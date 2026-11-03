const Groq = require("groq-sdk");

let client = null;

const getGroqConfig = () => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  return { apiKey, model };
};

const getGroqClient = () => {
  const { apiKey, model } = getGroqConfig();
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error("AI service is not configured. Please contact the administrator.");
    err.code = "GROQ_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  if (!client) {
    client = new Groq({ apiKey: String(apiKey).trim() });
  }
  return { client, model };
};

/** Reset cached client (used in tests). */
const resetGroqClient = () => {
  client = null;
};

module.exports = {
  getGroqConfig,
  getGroqClient,
  resetGroqClient,
};
