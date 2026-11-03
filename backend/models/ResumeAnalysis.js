const mongoose = require("mongoose");

const ResumeAnalysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    storedFileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    extractedSkills: {
      type: [String],
      default: [],
    },
    categorizedSkills: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sections: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    structuredFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Capped plain-text extract for recruiter/student AI evaluation only (never public).
    extractedText: {
      type: String,
      default: "",
      select: false,
    },
    isScanned: {
      type: Boolean,
      default: false,
    },
    scanNotice: {
      type: String,
      default: "",
    },
    ocrSupported: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["parsed", "reviewed", "failed"],
      default: "parsed",
    },
    // Per-field confirmation audit (does not prove qualification authenticity)
    fieldConfirmations: [
      {
        category: {
          type: String,
          enum: [
            "skills",
            "education",
            "experience",
            "projects",
            "internships",
            "certifications",
          ],
          required: true,
        },
        fieldKey: { type: String, default: "" },
        index: { type: Number, default: null },
        action: {
          type: String,
          enum: ["confirm", "reject", "edit"],
          required: true,
        },
        value: { type: mongoose.Schema.Types.Mixed, default: null },
        source: { type: String, default: "resume_extraction" },
        confidenceAtDecision: { type: String, default: "" },
        decidedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ResumeAnalysis", ResumeAnalysisSchema);
