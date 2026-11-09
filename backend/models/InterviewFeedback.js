const mongoose = require("mongoose");
const ratings = { type: Number, required: false, min: 1, max: 5 };
const InterviewFeedbackSchema = new mongoose.Schema({
  interviewRound: { type: mongoose.Schema.Types.ObjectId, ref: "InterviewRound", required: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true }, job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, institute: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", default: null },
  interviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ratings: { technicalKnowledge: ratings, problemSolving: ratings, communication: ratings, practicalSkills: ratings, roleSuitability: ratings },
  strengths: { type: String, trim: true, default: "", maxlength: 2000 }, improvementAreas: { type: String, trim: true, default: "", maxlength: 2000 }, interviewerNotes: { type: String, trim: true, default: "", maxlength: 4000 },
  overallRecommendation: { type: String, enum: ["STRONG_YES", "YES", "HOLD", "NO", ""], default: "" },
  status: { type: String, enum: ["DRAFT", "SUBMITTED"], default: "DRAFT" }, submittedAt: { type: Date, default: null },
}, { timestamps: true });
InterviewFeedbackSchema.index({ interviewRound: 1, interviewer: 1 }, { unique: true });
InterviewFeedbackSchema.index({ application: 1, company: 1 });
module.exports = mongoose.model("InterviewFeedback", InterviewFeedbackSchema);
