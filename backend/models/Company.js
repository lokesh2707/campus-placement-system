const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      default: "Technology",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Company verification: Platform Super Admin verification is separate from institute authorization
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    // Multi-institute association: allows the same company to be authorized across multiple institutes
    authorizedInstitutes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Institute",
      },
    ],
    // Company active status: Super Admin can activate / deactivate
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CompanySchema.index({ authorizedInstitutes: 1 });
CompanySchema.index({ isVerified: 1 });
CompanySchema.index({ isActive: 1 });

/**
 * Checks whether this company is authorized for a given institute.
 *
 * @param {string|mongoose.Types.ObjectId} instituteId
 * @returns {boolean}
 */
CompanySchema.methods.isAuthorizedForInstitute = function (instituteId) {
  if (!instituteId || !this.authorizedInstitutes) return false;
  const target = instituteId.toString();
  return this.authorizedInstitutes.some((inst) => inst.toString() === target);
};

module.exports = mongoose.model("Company", CompanySchema);
