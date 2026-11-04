const mongoose = require("mongoose");

const GeneratedResumeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
      enum: [
        "modern_ats_professional",
        "modern_minimalist",
        "technical_developer",
        "corporate_experienced",
        "fresher_graduate",
        // legacy ids retained for previously generated docs
        "ats_professional",
        "modern_graduate",
        "developer_portfolio",
      ],
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    /** @deprecated legacy disk path; new resumes store PDF in fileData */
    relativePath: {
      type: String,
      trim: true,
      default: "",
    },
    /** PDF binary stored in MongoDB */
    fileData: {
      type: Buffer,
      default: undefined,
      select: false,
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    fileType: {
      type: String,
      default: "application/pdf",
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "generated", "failed"],
      default: "pending",
      index: true,
    },
    contentSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

GeneratedResumeSchema.index(
  { student: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
  }
);

GeneratedResumeSchema.index({ student: 1, version: -1 });

module.exports = mongoose.model("GeneratedResume", GeneratedResumeSchema);
