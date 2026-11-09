const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // Optional direct association to an institute
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      default: null,
    },
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeAnalysis",
    },
    status: {
      type: String,
      enum: [
        "Applied",
        "Shortlisted",
        "Under Review",
        "Assessment",
        "Interview",
        "Selected",
        "Rejected",
        "Withdrawn",
        "Offer Declined",
        "Offer Revoked",
      ],
      default: "Applied",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" },
      },
    ],
    notes: {
      type: String,
      default: "",
    },
    // Short-lived claim serializes Offer creation with resolution requests.
    // It expires automatically so a worker crash cannot permanently block the Application.
    offerCreationClaim: {
      claimId: { type: String, default: null },
      claimedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      state: { type: String, enum: ["CREATING", "COMPLETED", null], default: null },
      offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
    },
    aiEvaluation: {
      matchScore: { type: Number, min: 0, max: 100 },
      scoreSource: {
        type: String,
        enum: ["ml_service", "offline_node", ""],
        default: "",
      },
      isEligible: { type: Boolean },
      eligibilityStatus: {
        type: String,
        enum: ["Eligible", "Not eligible", "Needs review"],
        default: "Needs review",
      },
      eligibilityReasons: { type: [String], default: [] },
      missingData: { type: [String], default: [] },
      matchedRequiredSkills: { type: [String], default: [] },
      missingRequiredSkills: { type: [String], default: [] },
      matchedPreferredSkills: { type: [String], default: [] },
      missingPreferredSkills: { type: [String], default: [] },
      textSimilarityPercent: { type: Number, default: 0 },
      relevantEvidence: { type: [String], default: [] },
      explanation: { type: String, default: "" },
      evaluatedAt: { type: Date },
      evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resumeVersion: { type: String, default: "" },
    },
    // Durable crash-recoverable offer resolution state
    offerResolution: {
      operationId: { type: String, default: null, trim: true },
      resolutionStatus: {
        type: String,
        enum: ["Offer Declined", "Offer Revoked", null],
        default: null,
      },
      reason: { type: String, default: "", trim: true },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      resolvedAt: { type: Date, default: null },
      durableState: {
        type: String,
        enum: ["PENDING", "COMPLETED", null],
        default: null,
      },
      actorError: { type: String, default: null, trim: true },
      steps: {
        applicationUpdated: { type: Boolean, default: false },
        vacancyReleased: { type: Boolean, default: false },
        profileUpdated: { type: Boolean, default: false },
        auditLogged: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications: one application per student per job
ApplicationSchema.index({ student: 1, job: 1 }, { unique: true });
ApplicationSchema.index({ job: 1, status: 1 });
ApplicationSchema.index({ institute: 1 });
ApplicationSchema.index({ "offerResolution.durableState": 1 });
ApplicationSchema.index({ "offerResolution.operationId": 1 }, { sparse: true });

module.exports = mongoose.model("Application", ApplicationSchema);
