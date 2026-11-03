/**
 * Shared headers for Node → local ML service calls.
 * When ML_SERVICE_TOKEN is set, the FastAPI service requires X-ML-Service-Token.
 */
const mlServiceHeaders = (extra = {}) => {
  const headers = { ...extra };
  const token = (process.env.ML_SERVICE_TOKEN || "").trim();
  if (token) {
    headers["X-ML-Service-Token"] = token;
  }
  return headers;
};

const mlServiceUrl = () =>
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

module.exports = {
  mlServiceHeaders,
  mlServiceUrl,
};
