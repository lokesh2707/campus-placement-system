const mongoose = require("mongoose");
const InterviewRoundSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  institute: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", default: null },
  roundNumber: { type: Number, required: true, min: 1 },
  roundName: { type: String, required: true, trim: true, maxlength: 120 },
  interviewType: { type: String, required: true, enum: ["TECHNICAL", "HR", "MANAGERIAL", "GROUP_DISCUSSION", "CODING", "OTHER"] },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, required: true, min: 10, max: 480 },
  interviewMode: { type: String, required: true, enum: ["ONLINE", "OFFLINE"] },
  meetingLink: { type: String, trim: true, default: "", maxlength: 500 },
  location: { type: String, trim: true, default: "", maxlength: 300 },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"], default: "SCHEDULED" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  completedAt: { type: Date, default: null }, cancelledAt: { type: Date, default: null },
}, { timestamps: true });
InterviewRoundSchema.index({ application: 1, roundNumber: 1 }, { unique: true });
InterviewRoundSchema.index({ institute: 1, scheduledAt: 1 });
InterviewRoundSchema.index({ company: 1, scheduledAt: 1 });
module.exports = mongoose.model("InterviewRound", InterviewRoundSchema);
