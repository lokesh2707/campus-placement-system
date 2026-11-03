const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company reference is required"],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Optional direct association to an institute (for on-campus / institutional drives)
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      default: null,
    },
    description: {
      type: String,
      required: [true, "Job description is required"],
    },
    requiredSkills: {
      type: [String],
      required: [true, "At least one required skill must be defined"],
      default: [],
    },
    preferredSkills: {
      type: [String],
      default: [],
    },
    eligibilityCriteria: {
      minCgpa: {
        type: Number,
        default: 0.0,
        min: 0.0,
        max: 10.0,
      },
      allowedDepartments: {
        type: [String],
        default: [], // Empty means all departments eligible
      },
      batch: {
        type: Number,
        default: 2026,
      },
      maxBacklogs: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    salary: {
      lpa: { type: Number, default: 0 },
      range: { type: String, default: "" },
    },
    location: {
      type: String,
      required: [true, "Job location is required"],
      trim: true,
    },
    employmentType: {
      type: String,
      enum: ["full-time", "internship", "contract"],
      default: "full-time",
    },
    deadline: {
      type: Date,
    },
    vacancies: {
      type: Number,
      default: 1,
      min: [1, "Vacancies must be at least 1"],
    },
    selectedApplications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Application",
      },
    ],
    recruitmentStages: {
      type: [String],
      default: [
        "Applied",
        "Under Review",
        "Assessment",
        "Interview",
        "Selected",
        "Rejected",
      ],
    },
    status: {
      type: String,
      enum: ["draft", "open", "closed"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

JobSchema.index({ status: 1, "eligibilityCriteria.minCgpa": 1 });
JobSchema.index({ requiredSkills: 1 });
JobSchema.index({ institute: 1 });
JobSchema.index({ company: 1, status: 1 });
JobSchema.index({ deadline: 1, status: 1 });

module.exports = mongoose.model("Job", JobSchema);
