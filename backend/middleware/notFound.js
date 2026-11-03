const notFound = (req, res, next) => {
  // Avoid reflecting full request paths in production responses.
  const detail =
    process.env.NODE_ENV === "production"
      ? "Route not found"
      : `Route not found: ${req.method} ${req.originalUrl}`;
  res.status(404).json({
    success: false,
    message: detail,
  });
};

module.exports = notFound;
