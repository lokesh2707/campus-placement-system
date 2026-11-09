require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/studentProfile.routes");
const resumeRoutes = require("./routes/resume.routes");
const jobRoutes = require("./routes/job.routes");
const recommendationRoutes = require("./routes/recommendation.routes");
const applicationRoutes = require("./routes/application.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const adminRoutes = require("./routes/admin.routes");
const officerRoutes = require("./routes/officer.routes");
const recruiterRoutes = require("./routes/recruiter.routes");
const notificationRoutes = require("./routes/notification.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const readinessRoutes = require("./routes/readiness.routes");
const resumeBuilderRoutes = require("./routes/resumeBuilder.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const AdminAuditLog = require("./models/AdminAuditLog");
const Attendance = require("./models/Attendance");
const { resumePendingOfferResolutions } = require("./utils/offerRecovery");
const { reconcilePendingOfferResolutions } = require("./services/offerResolutionReconciliation");

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api", attendanceRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/readiness", readinessRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/resume-builder", resumeBuilderRoutes);
app.use("/api/notifications", notificationRoutes);

// Fallback 404 handler for unknown routes
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

// Start server after connecting to database
const startServer = async () => {
  await connectDB();
  await AdminAuditLog.ensureIndexesSafe();
  await Attendance.createIndexes();
  await resumePendingOfferResolutions();
  // Complete Offer documents whose Application resolution was already durably
  // recovered before a previous process stopped. This is a single startup pass,
  // not a recurring worker.
  await reconcilePendingOfferResolutions();
  const { startNotificationWorker } = require("./services/notificationWorker");
  const worker = startNotificationWorker();
  const server = app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await worker.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
