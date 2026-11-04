const mongoose = require("mongoose");

const StudentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One profile per student user
    },
    // Institute reference: must match the corresponding User.institute
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      default: null,
    },
    rollNumber: {
      type: String,
      required: [true, "Roll number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    degree: {
      type: String,
      trim: true,
      default: "B.Tech",
    },
    // Confirmed education institution from resume review (optional; not the institute org ref)
    educationInstitution: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "Education institution cannot exceed 200 characters"],
    },
    // Confirmed graduation year from resume review — distinct from verified placement batch.
    // Never used to overwrite batch; eligibility matching continues to use batch.
    graduationYear: {
      type: Number,
      default: null,
      min: [1950, "Graduation year is invalid"],
      max: [2050, "Graduation year is invalid"],
    },
    batch: {
      type: Number,
      required: [true, "Graduation batch year is required"],
      min: [2000, "Batch year is invalid"],
      max: [2050, "Batch year is invalid"],
    },
    cgpa: {
      type: Number,
      required: [true, "CGPA is required"],
      min: [0.0, "CGPA cannot be negative"],
      max: [10.0, "CGPA cannot exceed 10.0"],
    },
    backlogs: {
      type: Number,
      default: 0,
      min: [0, "Backlogs cannot be negative"],
    },
    activeBacklogs: {
      type: Number,
      default: 0,
      min: [0, "Active backlogs cannot be negative"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say", ""],
      default: "",
    },
    address: {
      street: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      zipCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "India" },
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    // Optional professional links for resume builder (HTTPS only when set)
    githubUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "GitHub URL is too long"],
    },
    linkedinUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "LinkedIn URL is too long"],
    },
    portfolioUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Portfolio URL is too long"],
    },
    professionalSummary: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1200, "Professional summary cannot exceed 1200 characters"],
    },
    academicHistory: {
      // College start year; graduation year uses StudentProfile.batch (from registration/academic)
      collegeStartYear: {
        type: Number,
        default: null,
        min: [1950, "College start year is invalid"],
        max: [2050, "College start year is invalid"],
      },
      // Higher secondary (12th)
      intermediateName: { type: String, trim: true, default: "", maxlength: 200 },
      intermediateDuration: { type: String, trim: true, default: "", maxlength: 60 },
      twelfthPercentage: { type: Number, min: 0, max: 100, default: null },
      // Secondary (10th)
      schoolName: { type: String, trim: true, default: "", maxlength: 200 },
      schoolDuration: { type: String, trim: true, default: "", maxlength: 60 },
      tenthPercentage: { type: Number, min: 0, max: 100, default: null },
      diplomaPercentage: { type: Number, min: 0, max: 100, default: null },
      semesters: [
        {
          semester: { type: Number, min: 1, max: 10 },
          sgpa: { type: Number, min: 0, max: 10 },
        },
      ],
    },
    // Overall flat skills list (preserves backward compatibility with matching and recs)
    skills: {
      type: [String],
      default: [],
    },
    // Categorized skill taxonomies
    technicalSkills: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: [],
    },
    frameworks: {
      type: [String],
      default: [],
    },
    databases: {
      type: [String],
      default: [],
    },
    tools: {
      type: [String],
      default: [],
    },
    projects: [
      {
        title: { type: String, required: [true, "Project title is required"], trim: true },
        // Original student-authored description — never overwritten by AI
        description: { type: String, trim: true, default: "" },
        aiEnhancedDescription: { type: String, trim: true, default: "" },
        aiEnhancedApproved: { type: Boolean, default: false },
        // Hash of title+description+technologies at enhance/approve time
        aiEnhancedSourceHash: { type: String, trim: true, default: "" },
        technologies: { type: [String], default: [] },
        link: { type: String, trim: true, default: "" },
        githubUrl: { type: String, trim: true, default: "" },
        liveUrl: { type: String, trim: true, default: "" },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
      },
    ],
    experience: [
      {
        role: { type: String, required: [true, "Role is required"], trim: true },
        company: { type: String, required: [true, "Company is required"], trim: true },
        duration: { type: String, trim: true, default: "" },
        description: { type: String, trim: true, default: "" },
        aiEnhancedDescription: { type: String, trim: true, default: "" },
        aiEnhancedApproved: { type: Boolean, default: false },
        aiEnhancedSourceHash: { type: String, trim: true, default: "" },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        isCurrent: { type: Boolean, default: false },
      },
    ],
    certifications: [
      {
        title: { type: String, required: [true, "Certification title is required"], trim: true },
        issuingOrganization: { type: String, trim: true, default: "" },
        issueDate: { type: Date, default: null },
        expiryDate: { type: Date, default: null },
        credentialUrl: { type: String, trim: true, default: "" },
        credentialId: { type: String, trim: true, default: "" },
      },
    ],
    placementStatus: {
      type: String,
      enum: ["seeking", "placed", "opted_out"],
      default: "seeking",
    },
    placementOutcome: {
      source: {
        type: String,
        enum: [
          "on_campus",
          "off_campus",
          "higher_studies",
          "entrepreneurship",
          "competitive_exams",
          "administrative_override",
          "none",
        ],
        default: "none",
      },
      companyName: {
        type: String,
        trim: true,
        default: "",
      },
      application: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Application",
        default: null,
      },
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      recordedAt: {
        type: Date,
        default: null,
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
    },
    resumeUrl: {
      type: String,
      default: "",
    },
    resumeFileName: {
      type: String,
      default: "",
    },
    resumeFileSize: {
      type: Number,
      default: 0,
    },
    resumeUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying and filtering
StudentProfileSchema.index({ institute: 1 });
StudentProfileSchema.index({ cgpa: 1, department: 1, batch: 1 });
StudentProfileSchema.index({ backlogs: 1 });
StudentProfileSchema.index({ placementStatus: 1 });
StudentProfileSchema.index({ skills: 1 });
StudentProfileSchema.index({ technicalSkills: 1 });

module.exports = mongoose.model("StudentProfile", StudentProfileSchema);
