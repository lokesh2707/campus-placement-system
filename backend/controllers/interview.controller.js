const Application = require("../models/Application");
const InterviewRound = require("../models/InterviewRound");
const InterviewFeedback = require("../models/InterviewFeedback");
const AdminAuditLog = require("../models/AdminAuditLog");
const { verifyApplicationAccess } = require("./application.controller");
const { normalizeRole, ROLES } = require("../constants/roles");
const publishBusinessEvent = require("../services/publishBusinessEvent");

const idOf = (value) => value && String(value._id || value);
const validDate = (value) => value instanceof Date
  ? !Number.isNaN(value.getTime())
  : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
const publicRound = (r) => ({ _id: r._id, job: r.job, roundNumber: r.roundNumber, roundName: r.roundName, interviewType: r.interviewType, scheduledAt: r.scheduledAt, durationMinutes: r.durationMinutes, interviewMode: r.interviewMode, meetingLink: r.meetingLink, location: r.location, status: r.status, completedAt: r.completedAt, cancelledAt: r.cancelledAt });
const audit = (action, req, round) => AdminAuditLog.create({ action, performedBy: req.user._id, targetCompany: round.company, targetInstitute: round.institute, details: { interviewRoundId: round._id, applicationId: round.application, status: round.status } }).catch(() => {});
const loadRound = (id) => InterviewRound.findById(id);
const ensureRecruiterRound = (req, round) => {
  if (normalizeRole(req.user?.role) !== ROLES.RECRUITER) return false;
  return verifyApplicationAccess(req.user, { student: round.student, company: round.company, institute: round.institute }).authorized;
};

const validateRoundDetails = (values) => {
  if (!values.roundName || typeof values.roundName !== "string" || !values.roundName.trim()) return "Round name is required.";
  if (!Number.isInteger(Number(values.roundNumber)) || Number(values.roundNumber) < 1) return "Round number must be a positive integer.";
  if (!values.interviewType || !InterviewRound.schema.path("interviewType").enumValues.includes(values.interviewType)) return "Invalid interview type.";
  if (!validDate(values.scheduledAt)) return "A valid interview date is required.";
  const duration = Number(values.durationMinutes);
  if (!Number.isInteger(duration) || duration < 10 || duration > 480) return "Duration must be an integer between 10 and 480 minutes.";
  if (!["ONLINE", "OFFLINE"].includes(values.interviewMode)) return "Interview mode must be ONLINE or OFFLINE.";
  if (values.interviewMode === "ONLINE") {
    if (values.location && String(values.location).trim()) return "Online interviews cannot include an offline location.";
    if (values.meetingLink) {
      try {
        const url = new URL(values.meetingLink);
        if (url.protocol !== "https:" || !url.hostname) return "Meeting link must use a valid HTTPS URL.";
      } catch (_) { return "Meeting link must use a valid HTTPS URL."; }
    }
  } else {
    if (!String(values.location || "").trim()) return "Location is required for offline interviews.";
    if (values.meetingLink && String(values.meetingLink).trim()) return "Offline interviews cannot include an online meeting link.";
  }
  return null;
};

const loadAuthorizedRoundContext = async (req, round) => {
  const application = await Application.findById(round.application)
    .populate("job")
    .populate("studentProfile", "institute")
    .populate("student", "institute");
  if (!application) return { status: 403, message: "Interview ownership could not be verified." };
  const consistent = idOf(round.application) === idOf(application._id)
    && idOf(round.job) === idOf(application.job)
    && idOf(round.student) === idOf(application.student)
    && idOf(round.company) === idOf(application.company)
    && idOf(round.institute) === idOf(application.institute)
    && Boolean(application.company && application.job)
    && idOf(application.job.company) === idOf(application.company)
    && (!application.studentProfile?.institute || !application.institute || idOf(application.studentProfile.institute) === idOf(application.institute))
    && (!application.student?.institute || !application.institute || idOf(application.student.institute) === idOf(application.institute));
  if (!consistent) return { status: 403, message: "Interview ownership could not be verified." };
  if (!ensureRecruiterRound(req, application)) return { status: 403, message: "Not authorized." };
  return { round, application };
};
const loadAuthorizedFeedbackContext = async (req, feedback) => {
  if (String(feedback.interviewer) !== String(req.user?._id)) return { status: 403, message: "Only the interviewer may access this feedback." };
  const round = await InterviewRound.findById(feedback.interviewRound);
  if (!round) return { status: 404, message: "Interview round not found." };
  const context = await loadAuthorizedRoundContext(req, round);
  if (context.status) return context;
  const { application } = context;
  const consistent = idOf(feedback.application) === idOf(application._id)
    && idOf(feedback.job) === idOf(application.job)
    && idOf(feedback.student) === idOf(application.student)
    && idOf(feedback.company) === idOf(application.company)
    && idOf(feedback.institute) === idOf(application.institute);
  if (!consistent) return { status: 403, message: "Feedback ownership could not be verified." };
  return context;
};

const createRound = async (req, res, next) => { try {
  const app = await Application.findById(req.params.applicationId).populate("job").populate("studentProfile", "institute").populate("student", "institute");
  if (!app) return res.status(404).json({ success:false, message:"Application not found" });
  const access = verifyApplicationAccess(req.user, app); if (!access.authorized) return res.status(403).json({ success:false, message:access.message });
  if (app.status !== "Interview") return res.status(400).json({ success:false, message:"Interview rounds can only be scheduled for applications in Interview stage." });
  const details = { ...req.body };
  const validationError = validateRoundDetails(details);
  if (validationError) return res.status(400).json({ success:false, message:validationError });
  const round = await InterviewRound.create({ application:app._id, job:app.job, student:app.student, company:app.company, institute:app.institute, roundNumber:Number(details.roundNumber), roundName:details.roundName.trim(), interviewType:details.interviewType, scheduledAt:new Date(details.scheduledAt), durationMinutes:Number(details.durationMinutes), interviewMode:details.interviewMode, meetingLink:String(details.meetingLink || "").trim(), location:String(details.location || "").trim(), interviewer:req.user._id, createdBy:req.user._id, updatedBy:req.user._id });
  await audit("interview_round_created",req,round); await publishBusinessEvent({eventType:"INTERVIEW_SCHEDULED",aggregateType:"InterviewRound",aggregateId:round._id,actor:req.user._id,institute:round.institute,company:round.company,idempotencyKey:`interview:${round._id}:scheduled`}); res.status(201).json({success:true,round});
} catch(e) { if(e.code===11000) return res.status(409).json({success:false,message:"This round number already exists for the application."}); next(e); } };

const listRecruiterRounds = async (req,res,next)=>{try{const app=await Application.findById(req.params.applicationId);if(!app)return res.status(404).json({success:false,message:"Application not found"});const a=verifyApplicationAccess(req.user,app);if(!a.authorized)return res.status(403).json({success:false,message:a.message});const rounds=await InterviewRound.find({application:app._id}).sort({roundNumber:1});const feedback=await InterviewFeedback.find({application:app._id,interviewer:req.user._id});const own=new Map(feedback.map(f=>[String(f.interviewRound),f]));res.json({success:true,rounds:rounds.map(r=>({...r.toObject(),ownFeedback:own.get(String(r._id))||null}))});}catch(e){next(e)}};

const updateRound = async(req,res,next)=>{try{
  const round=await loadRound(req.params.roundId); if(!round)return res.status(404).json({success:false,message:"Interview round not found"});
  if(!ensureRecruiterRound(req,round))return res.status(403).json({success:false,message:"Not authorized"});
  if(["COMPLETED","CANCELLED"].includes(round.status))return res.status(400).json({success:false,message:"Completed or cancelled rounds are immutable."});
  const next={roundNumber:round.roundNumber,roundName:round.roundName,interviewType:round.interviewType,scheduledAt:round.scheduledAt,durationMinutes:round.durationMinutes,interviewMode:round.interviewMode,meetingLink:round.meetingLink,location:round.location};
  for(const key of Object.keys(next))if(req.body[key]!==undefined)next[key]=req.body[key];
  const validationError=validateRoundDetails(next); if(validationError)return res.status(400).json({success:false,message:validationError});
  const set={roundName:String(next.roundName).trim(),interviewType:next.interviewType,scheduledAt:new Date(next.scheduledAt),durationMinutes:Number(next.durationMinutes),interviewMode:next.interviewMode,meetingLink:String(next.meetingLink||"").trim(),location:String(next.location||"").trim(),updatedBy:req.user._id,status:"RESCHEDULED"};
  const updated=await InterviewRound.findOneAndUpdate({_id:round._id,status:round.status},{$set:set},{new:true,returnDocument:"after",runValidators:true});
  if(!updated)return res.status(409).json({success:false,message:"Interview round changed before it could be rescheduled."});
  await audit("interview_round_rescheduled",req,updated);await publishBusinessEvent({eventType:"INTERVIEW_RESCHEDULED",aggregateType:"InterviewRound",aggregateId:updated._id,actor:req.user._id,institute:updated.institute,company:updated.company,idempotencyKey:`interview:${updated._id}:rescheduled:${(updated.updatedAt||new Date()).getTime()}`});res.json({success:true,round:updated});
}catch(e){next(e)}};

const ROUND_TRANSITIONS = Object.freeze({
  SCHEDULED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  RESCHEDULED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
});
const updateRoundStatus=async(req,res,next)=>{try{
  const round=await loadRound(req.params.roundId);if(!round)return res.status(404).json({success:false,message:"Interview round not found"});
  if(!ensureRecruiterRound(req,round))return res.status(403).json({success:false,message:"Not authorized"});
  const {status}=req.body;
  if(status===round.status)return res.json({success:true,round});
  if(!ROUND_TRANSITIONS[round.status]?.includes(status))return res.status(400).json({success:false,message:"Invalid interview status transition."});
  const now=new Date();const set={status,updatedBy:req.user._id};
  if(status==="COMPLETED")set.completedAt=now;
  if(status==="CANCELLED")set.cancelledAt=now;
  const updated=await InterviewRound.findOneAndUpdate({_id:round._id,status:round.status},{$set:set},{new:true,returnDocument:"after",runValidators:true});
  if(!updated)return res.status(409).json({success:false,message:"Interview round changed before the requested transition."});
  await audit(status==="CANCELLED"?"interview_round_cancelled":"interview_round_status_changed",req,updated);if(status==="CANCELLED")await publishBusinessEvent({eventType:"INTERVIEW_CANCELLED",aggregateType:"InterviewRound",aggregateId:updated._id,actor:req.user._id,institute:updated.institute,company:updated.company,idempotencyKey:`interview:${updated._id}:cancelled`});res.json({success:true,round:updated});
}catch(e){next(e)}};

const saveFeedback=async(req,res,next)=>{try{
  const round=await loadRound(req.params.roundId);if(!round)return res.status(404).json({success:false,message:"Interview round not found"});
  const context=await loadAuthorizedRoundContext(req,round);if(context.status)return res.status(context.status).json({success:false,message:context.message});
  if(round.status==="CANCELLED")return res.status(400).json({success:false,message:"Cannot evaluate a cancelled round."});
  const fields=["ratings","strengths","improvementAreas","interviewerNotes","overallRecommendation"];const changes={};for(const k of fields)if(req.body[k]!==undefined)changes[k]=req.body[k];
  let feedback=await InterviewFeedback.findOne({interviewRound:round._id,interviewer:req.user._id});
  if(feedback?.status==="SUBMITTED")return res.status(409).json({success:false,message:"Submitted feedback is immutable."});
  if(feedback){
    feedback=await InterviewFeedback.findOneAndUpdate({_id:feedback._id,interviewer:req.user._id,status:"DRAFT"},{$set:changes},{new:true,returnDocument:"after",runValidators:true});
    if(!feedback)return res.status(409).json({success:false,message:"Feedback changed or was submitted before this update."});
  }else{
    feedback=await InterviewFeedback.create({interviewRound:round._id,application:context.application._id,job:context.application.job,student:context.application.student,company:context.application.company,institute:context.application.institute,interviewer:req.user._id,...changes});
  }
  await audit("interview_feedback_created",req,round);res.status(201).json({success:true,feedback});
}catch(e){if(e.code===11000)return res.status(409).json({success:false,message:"Feedback already exists for this interviewer and round."});next(e)}};

const updateFeedback=async(req,res,next)=>{try{
  const f=await InterviewFeedback.findById(req.params.feedbackId);if(!f)return res.status(404).json({success:false,message:"Feedback not found"});
  if(String(f.interviewer)!==String(req.user?._id))return res.status(403).json({success:false,message:"Only the interviewer may access this feedback."});
  if(f.status!=="DRAFT")return res.status(409).json({success:false,message:"Submitted feedback is immutable."});
  const context=await loadAuthorizedFeedbackContext(req,f);if(context.status)return res.status(context.status).json({success:false,message:context.message});
  const changes={};for(const k of ["ratings","strengths","improvementAreas","interviewerNotes","overallRecommendation"])if(req.body[k]!==undefined)changes[k]=req.body[k];
  const updated=await InterviewFeedback.findOneAndUpdate({_id:f._id,interviewer:req.user._id,status:"DRAFT"},{$set:changes},{new:true,returnDocument:"after",runValidators:true});
  if(!updated)return res.status(409).json({success:false,message:"Feedback changed or was submitted before this update."});
  res.json({success:true,feedback:updated});
}catch(e){next(e)}};

const submitFeedback=async(req,res,next)=>{try{
  const f=await InterviewFeedback.findById(req.params.feedbackId);if(!f)return res.status(404).json({success:false,message:"Feedback not found"});
  const context=await loadAuthorizedFeedbackContext(req,f);if(context.status)return res.status(context.status).json({success:false,message:context.message});
  if(f.status!=="DRAFT")return res.status(409).json({success:false,message:"Feedback has already been submitted."});
  if(context.round.status!=="COMPLETED")return res.status(400).json({success:false,message:"Feedback can only be submitted after the interview round is completed."});
  const r=f.ratings||{};if(![r.technicalKnowledge,r.problemSolving,r.communication,r.practicalSkills,r.roleSuitability].every(x=>Number.isInteger(x)&&x>=1&&x<=5)||!["STRONG_YES","YES","HOLD","NO"].includes(f.overallRecommendation))return res.status(400).json({success:false,message:"All ratings and a recommendation are required before submission."});
  const updated=await InterviewFeedback.findOneAndUpdate({_id:f._id,interviewer:req.user._id,status:"DRAFT"},{$set:{status:"SUBMITTED",submittedAt:new Date()}},{new:true,returnDocument:"after",runValidators:true});
  if(!updated)return res.status(409).json({success:false,message:"Feedback changed or was submitted before this request."});
  await audit("interview_feedback_submitted",req,context.round);res.json({success:true,feedback:updated});
}catch(e){next(e)}};

const studentInterviews=async(req,res,next)=>{try{const rounds=await InterviewRound.find({student:req.user._id}).populate("job","title").populate("company","name").sort({scheduledAt:-1});res.json({success:true,rounds:rounds.map(publicRound)});}catch(e){next(e)}};
const officerInterviews=async(req,res,next)=>{try{const role=normalizeRole(req.user.role);const filter=role===ROLES.SUPER_ADMIN?{}:{institute:req.user.institute};if(role===ROLES.PLACEMENT_OFFICER&&!req.user.institute)return res.status(403).json({success:false,message:"Institute assignment required"});const rounds=await InterviewRound.find(filter).populate("job","title").populate("company","name").sort({scheduledAt:-1});res.json({success:true,rounds:rounds.map(publicRound)});}catch(e){next(e)}};

module.exports={createRound,listRecruiterRounds,updateRound,updateRoundStatus,saveFeedback,updateFeedback,submitFeedback,studentInterviews,officerInterviews,ROUND_TRANSITIONS,validateRoundDetails};
