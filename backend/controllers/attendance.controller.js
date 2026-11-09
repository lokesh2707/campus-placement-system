const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Application = require("../models/Application");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const Job = require("../models/Job");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const AdminAuditLog = require("../models/AdminAuditLog");
const { normalizeRole, ROLES } = require("../constants/roles");

const STATUSES = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const idOf = (value) => value && String(value._id || value);
const isAdmin = (user) => normalizeRole(user?.role) === ROLES.SUPER_ADMIN;
const isRecruiter = (user) => normalizeRole(user?.role) === ROLES.RECRUITER;
const isOfficer = (user) => normalizeRole(user?.role) === ROLES.PLACEMENT_OFFICER;
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const parsePagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  return { page, limit, skip: (page - 1) * limit };
};

const fail = (res) => res.status(403).json({ success: false, message: "Attendance access could not be authorized." });

async function loadJobContext(jobId) {
  if (!isObjectId(jobId)) return null;
  const job = await Job.findById(jobId);
  if (!job) return null;
  const company = await Company.findById(job.company);
  if (!company || idOf(job.company) !== idOf(company._id)) return null;
  return { job, company };
}

async function loadApplicationContext(application) {
  const [job, student, profile, company] = await Promise.all([
    Job.findById(application.job),
    User.findById(application.student),
    StudentProfile.findById(application.studentProfile),
    Company.findById(application.company),
  ]);
  if (!job || !student || !profile || !company) return null;
  if (normalizeRole(student.role) !== ROLES.STUDENT) return null;
  const instituteIds = [application.institute, student.institute, profile.institute]
    .map(idOf).filter(Boolean);
  if (!instituteIds.length || instituteIds.some((id) => id !== instituteIds[0])) return null;
  const instituteId = instituteIds[0];
  if (idOf(profile.user) !== idOf(student._id)
    || idOf(application.job) !== idOf(job._id)
    || idOf(job.company) !== idOf(company._id)
    || idOf(application.company) !== idOf(company._id)
    || (job.institute && idOf(job.institute) !== instituteId)) return null;
  return { application, job, student, profile, company, instituteId };
}

async function authorizeJobRead(user, context) {
  if (isAdmin(user)) return true;
  if (isRecruiter(user)) {
    return idOf(user.company) === idOf(context.job.company)
      && context.company.isVerified === true && context.company.isActive !== false;
  }
  if (!isOfficer(user) || !user.institute) return false;
  if (idOf(user.institute) !== idOf(context.job.institute)
    && !context.company.authorizedInstitutes?.some((id) => idOf(id) === idOf(user.institute))) return false;
  const institute = await Institute.findById(user.institute);
  return Boolean(institute && institute.status === "active");
}

async function authorizeApplicationRead(user, jobContext, appContext) {
  if (!appContext || idOf(appContext.job._id) !== idOf(jobContext.job._id)
    || idOf(appContext.company._id) !== idOf(jobContext.company._id)) return false;
  if (jobContext.job.institute && idOf(jobContext.job.institute) !== appContext.instituteId) return false;
  if (isAdmin(user)) return true;
  if (isRecruiter(user)) {
    if (idOf(user.company) !== idOf(jobContext.company._id)
      || jobContext.company.isVerified !== true || jobContext.company.isActive === false
      || !jobContext.company.authorizedInstitutes?.some((id) => idOf(id) === appContext.instituteId)) return false;
    const institute = await Institute.findById(appContext.instituteId);
    return Boolean(institute?.status === "active");
  }
  if (!isOfficer(user) || idOf(user.institute) !== appContext.instituteId) return false;
  const institute = await Institute.findById(user.institute);
  return Boolean(institute?.status === "active"
    && (idOf(jobContext.job.institute) === appContext.instituteId
      || jobContext.company.authorizedInstitutes?.some((id) => idOf(id) === appContext.instituteId)));
}

const staffAttendanceDto = (row, appContext, attendance, includeCorrectionHistory) => ({
  applicationId: String(row._id),
  student: {
    id: String(appContext.student._id),
    name: appContext.student.name,
    rollNumber: appContext.profile.rollNumber,
    department: appContext.profile.department,
    batch: appContext.profile.batch,
  },
  status: attendance?.status || "NOT_RECORDED",
  attendanceId: attendance ? String(attendance._id) : null,
  recordedAt: attendance?.recordedAt || null,
  recordedBy: attendance ? String(attendance.recordedBy) : null,
  lastModifiedBy: attendance ? String(attendance.lastModifiedBy) : null,
  revision: attendance?.revision || null,
  correctionHistory: includeCorrectionHistory ? attendance?.correctionHistory?.map((entry) => ({
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    changedBy: String(entry.changedBy),
    changedAt: entry.changedAt,
    reason: entry.reason,
  })) || [] : [],
});

const mutationDto = (attendance) => ({
  id: String(attendance._id),
  applicationId: String(attendance.application),
  status: attendance.status,
  recordedAt: attendance.recordedAt,
  revision: attendance.revision,
  correctionHistory: attendance.correctionHistory.map((entry) => ({
    previousStatus: entry.previousStatus, newStatus: entry.newStatus,
    changedAt: entry.changedAt, reason: entry.reason,
  })),
});

const auditMutation = async (action, user, context, attendance) => {
  try {
    await AdminAuditLog.create({
      action,
      performedBy: user._id,
      targetInstitute: context.instituteId,
      targetCompany: context.company._id,
      details: { attendanceId: attendance._id, applicationId: attendance.application, status: attendance.status, revision: attendance.revision },
    });
  } catch (error) {
    // Attendance persistence and the existing audit collection are separate writes.
    // The attendance change remains committed if audit storage is unavailable.
    console.error("Attendance audit write failed", { category: error?.name || "UNKNOWN" });
  }
};

const listJobAttendance = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Invalid pagination parameters." });
    const context = await loadJobContext(req.params.jobId);
    if (!context) return res.status(404).json({ success: false, message: "Job not found." });
    if (!await authorizeJobRead(req.user, context)) return fail(res);
    const filter = { job: context.job._id };
    if (isOfficer(req.user)) filter.institute = req.user.institute;
    const [total, applications] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter).sort({ createdAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.limit),
    ]);
    const attendanceRows = await Attendance.find({ application: { $in: applications.map((row) => row._id) } });
    const byApplication = new Map(attendanceRows.map((row) => [idOf(row.application), row]));
    const rows = [];
    for (const application of applications) {
      const appContext = await loadApplicationContext(application);
      if (!await authorizeApplicationRead(req.user, context, appContext)) continue;
      rows.push(staffAttendanceDto(application, appContext, byApplication.get(idOf(application._id)), isRecruiter(req.user) || isAdmin(req.user)));
    }
    return res.json({ success: true, job: { id: String(context.job._id), title: context.job.title, company: context.company.name }, rows, pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) } });
  } catch (error) { return next(error); }
};

const recordAttendance = async (req, res, next) => {
  try {
    if (!STATUSES.has(req.body?.status)) return res.status(400).json({ success: false, message: "Invalid attendance status." });
    if (!isObjectId(req.body?.applicationId)) return res.status(400).json({ success: false, message: "Valid applicationId is required." });
    const context = await loadJobContext(req.params.jobId);
    if (!context) return res.status(404).json({ success: false, message: "Job not found." });
    if (!isRecruiter(req.user) || !await authorizeJobRead(req.user, context)) return fail(res);
    const application = await Application.findById(req.body.applicationId);
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    const appContext = await loadApplicationContext(application);
    if (!await authorizeApplicationRead(req.user, context, appContext)) return fail(res);
    const now = new Date();
    let attendance;
    try {
      attendance = await Attendance.create({ application: application._id, status: req.body.status, recordedBy: req.user._id, recordedAt: now, lastModifiedBy: req.user._id, revision: 1, correctionHistory: [] });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ success: false, message: "Attendance has already been recorded for this application." });
      throw error;
    }
    await auditMutation("attendance_recorded", req.user, appContext, attendance);
    return res.status(201).json({ success: true, attendance: mutationDto(attendance) });
  } catch (error) { return next(error); }
};

const correctAttendance = async (req, res, next) => {
  try {
    const { status, reason, expectedRevision } = req.body || {};
    if (!STATUSES.has(status)) return res.status(400).json({ success: false, message: "Invalid attendance status." });
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return res.status(400).json({ success: false, message: "A positive expectedRevision is required." });
    if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 500) return res.status(400).json({ success: false, message: "A correction reason between 3 and 500 characters is required." });
    const existing = isObjectId(req.params.attendanceId) ? await Attendance.findById(req.params.attendanceId) : null;
    if (!existing) return res.status(404).json({ success: false, message: "Attendance record not found." });
    if (existing.revision !== expectedRevision) return res.status(409).json({ success: false, message: "Attendance changed; reload before correcting it again." });
    const application = await Application.findById(existing.application);
    if (!application) return fail(res);
    const appContext = await loadApplicationContext(application);
    if (!appContext || !isRecruiter(req.user) || !await authorizeApplicationRead(req.user, { job: appContext.job, company: appContext.company }, appContext)) return fail(res);
    if (existing.status === status) return res.status(400).json({ success: false, message: "Correction must change the attendance status." });
    const now = new Date();
    const updated = await Attendance.findOneAndUpdate(
      { _id: existing._id, revision: expectedRevision },
      { $set: { status, lastModifiedBy: req.user._id }, $inc: { revision: 1 }, $push: { correctionHistory: { previousStatus: existing.status, newStatus: status, changedBy: req.user._id, changedAt: now, reason: reason.trim() } } },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ success: false, message: "Attendance changed; reload before correcting it again." });
    await auditMutation("attendance_corrected", req.user, appContext, updated);
    return res.json({ success: true, attendance: mutationDto(updated) });
  } catch (error) { return next(error); }
};

const myAttendance = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: "Invalid pagination parameters." });
    const filter = { student: req.user._id };
    const [total, applications] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter).sort({ createdAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.limit),
    ]);
    const attendanceRows = await Attendance.find({ application: { $in: applications.map((row) => row._id) } });
    const byApplication = new Map(attendanceRows.map((row) => [idOf(row.application), row]));
    const rows = [];
    for (const application of applications) {
      const context = await loadApplicationContext(application);
      if (!context || idOf(context.student._id) !== idOf(req.user._id)) continue;
      const attendance = byApplication.get(idOf(application._id));
      rows.push({ applicationId: String(application._id), job: { id: String(context.job._id), title: context.job.title }, company: { id: String(context.company._id), name: context.company.name }, status: attendance?.status || "NOT_RECORDED", recordedAt: attendance?.recordedAt || null });
    }
    return res.json({ success: true, rows, pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) } });
  } catch (error) { return next(error); }
};

module.exports = { listJobAttendance, recordAttendance, correctAttendance, myAttendance, STATUSES, parsePagination, loadApplicationContext, authorizeApplicationRead };
