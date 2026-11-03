const mongoose = require("mongoose");

const InstituteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Institute name is required"],
      unique: true,
      trim: true,
      maxlength: [150, "Institute name cannot exceed 150 characters"],
    },
    code: {
      type: String,
      required: [true, "Institute code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, "Institute code cannot exceed 20 characters"],
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Institute", InstituteSchema);
