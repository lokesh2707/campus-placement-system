const mongoose = require("mongoose");

const CorrectionSchema = new mongoose.Schema({
  previousStatus: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"], required: true },
  newStatus: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"], required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
}, { _id: false });

const AttendanceSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true, immutable: true },
  status: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  recordedAt: { type: Date, required: true, immutable: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  revision: { type: Number, required: true, default: 1, min: 1 },
  correctionHistory: { type: [CorrectionSchema], default: [] },
}, { timestamps: true });

AttendanceSchema.index({ application: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
