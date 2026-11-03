const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, LEGACY_ROLE_MAP, ALL_ROLES, normalizeRole } = require("../constants/roles");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Exclude password from query results by default
    },
    role: {
      type: String,
      enum: {
        values: [
          ...ALL_ROLES,
          // Support legacy enum values during migration so unmigrated docs don't fail validation
          "admin",
          "placement_officer",
          "recruiter",
          "student",
        ],
        message: "{VALUE} is not a valid user role",
      },
      default: ROLES.STUDENT,
      set: (val) => {
        if (!val) return val;
        return normalizeRole(val);
      },
    },
    // Institute association: required for PLACEMENT_OFFICER & STUDENT (when registered with institute)
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      default: null,
    },
    // Company association: required for RECRUITER
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    // Forced password reset on first login (for invited recruiters)
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    // Tracks who invited/provisioned this account (e.g. Placement Officer inviting a Recruiter)
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Indexes for common query patterns
UserSchema.index({ role: 1 });
UserSchema.index({ institute: 1 });
UserSchema.index({ company: 1 });

/**
 * Validates role-specific association requirements without breaking existing unassociated accounts.
 * Used for data integrity verification, audits, and provisioning workflows.
 *
 * @returns {{ isValid: boolean, missingField: string|null, message: string|null }}
 */
UserSchema.methods.validateRoleAssociations = function () {
  const normalized = normalizeRole(this.role);

  if (normalized === ROLES.PLACEMENT_OFFICER && !this.institute) {
    return {
      isValid: false,
      missingField: "institute",
      message: "Placement Officer must have an assigned institute.",
    };
  }

  if (normalized === ROLES.RECRUITER && !this.company) {
    return {
      isValid: false,
      missingField: "company",
      message: "Recruiter must have an authorized company association.",
    };
  }

  if (normalized === ROLES.STUDENT && !this.institute) {
    return {
      isValid: false,
      missingField: "institute",
      message: "Student must have an assigned institute.",
    };
  }

  return {
    isValid: true,
    missingField: null,
    message: null,
  };
};

// Hash password before saving if it has been modified
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to check password validity
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
