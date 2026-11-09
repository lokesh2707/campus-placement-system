const Application = require("../models/Application");
const InterviewRound = require("../models/InterviewRound");
const Offer = require("../models/Offer");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Job = require("../models/Job");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const { DOMAIN_EVENTS } = require("../constants/domainEvents");

const copy = (v) => v == null ? null : String(v);
const authorizedCompany = async (CompanyModel, companyId, instituteId) => {
  if (!companyId) return false;
  const company = await CompanyModel.findById(companyId).lean();
  return !!company && company.isActive === true && company.isVerified === true && (!instituteId || (company.authorizedInstitutes || []).some((id) => copy(id) === copy(instituteId)));
};
const validJobChain = async (JobModel, app) => {
  if (!app?.job) return false;
  const job = await JobModel.findById(app.job).lean();
  return !!job && copy(job.company) === copy(app.company);
};
const actionFor = (type, role, entityId) => {
  const id = String(entityId);
  if (role === "student" || role === "STUDENT") return type.startsWith("INTERVIEW_") ? "/student/applications" : type.startsWith("OFFER_") || type === DOMAIN_EVENTS.JOINING_STATUS_UPDATED ? "/student/offers" : "/student/applications";
  if (role === "recruiter" || role === "RECRUITER") return type.startsWith("OFFER_") || type === DOMAIN_EVENTS.JOINING_STATUS_UPDATED ? "/recruiter/offers" : `/recruiter/jobs`;
  return type.startsWith("OFFER_") ? "/placement-officer/offers" : "/placement-officer/dashboard";
};

const templates = {
  APPLICATION_SUBMITTED: ["New application", "A student submitted an application."],
  APPLICATION_WITHDRAWN: ["Application withdrawn", "A student withdrew an application."],
  APPLICATION_STATUS_CHANGED: ["Application update", "An application status changed."],
  INTERVIEW_SCHEDULED: ["Interview scheduled", "An interview round was scheduled."],
  INTERVIEW_RESCHEDULED: ["Interview rescheduled", "An interview round was rescheduled."],
  INTERVIEW_CANCELLED: ["Interview cancelled", "An interview round was cancelled."],
  OFFER_ISSUED: ["Offer received", "A company issued you an offer."],
  OFFER_ACCEPTED: ["Offer accepted", "A student accepted an offer."],
  OFFER_DECLINED: ["Offer declined", "A student declined an offer."],
  OFFER_REVOKED: ["Offer update", "An offer was revoked."],
  OFFER_EXPIRED: ["Offer expired", "An offer has expired."],
  JOINING_STATUS_UPDATED: ["Joining update", "A joining outcome was recorded."],
};

async function resolveRecipients(event, models = {}) {
  const App = models.Application || Application; const Round = models.InterviewRound || InterviewRound;
  const OfferModel = models.Offer || Offer; const UserModel = models.User || User;
  const JobModel = models.Job || Job; const CompanyModel = models.Company || Company; const InstituteModel = models.Institute || Institute;
  const type = event.eventType; const id = event.aggregateId;
  if (type.startsWith("INTERVIEW_")) {
    const round = await Round.findById(id).lean();
    if (!round || !round.application || !round.student || !round.company) return { recipients: [], entityType: "InterviewRound", entityId: id };
    const app = await App.findById(round.application).lean();
    if (!app || copy(app.student) !== copy(round.student) || copy(app.company) !== copy(round.company) || copy(app.job) !== copy(round.job) || !(await validJobChain(JobModel, app)) || !(await authorizedCompany(CompanyModel, app.company, app.institute))) return { recipients: [], entityType: "InterviewRound", entityId: id };
    const student = await UserModel.findOne({ _id: round.student, isActive: true, role: { $in: ["STUDENT", "student"] } }).lean();
    return { recipients: student ? [student] : [], entityType: "InterviewRound", entityId: id };
  }
  if (type.startsWith("OFFER_") || type === DOMAIN_EVENTS.JOINING_STATUS_UPDATED) {
    const offer = await OfferModel.findById(id).lean();
    if (!offer || !offer.application || !offer.student || !offer.company) return { recipients: [], entityType: "Offer", entityId: id };
    const app = await App.findById(offer.application).lean();
    if (!app || copy(app.student) !== copy(offer.student) || copy(app.company) !== copy(offer.company) || copy(app.job) !== copy(offer.job) || !(await validJobChain(JobModel, app)) || !(await authorizedCompany(CompanyModel, app.company, app.institute))) return { recipients: [], entityType: "Offer", entityId: id };
    const studentFacing = [DOMAIN_EVENTS.OFFER_ISSUED, DOMAIN_EVENTS.OFFER_REVOKED, DOMAIN_EVENTS.OFFER_EXPIRED].includes(type);
    const role = studentFacing ? { $in: ["STUDENT", "student"] } : { $in: ["RECRUITER", "recruiter"] };
    const query = { role, isActive: true, ...(studentFacing ? { _id: offer.student } : { company: offer.company }) };
    const recipients = await UserModel.find(query).lean();
    return { recipients, entityType: "Offer", entityId: id };
  }
  const app = await App.findById(id).lean();
  if (!app || !app.student || !app.company || !(await validJobChain(JobModel, app)) || !(await authorizedCompany(CompanyModel, app.company, app.institute))) return { recipients: [], entityType: "Application", entityId: id };
  const recipients = type === DOMAIN_EVENTS.APPLICATION_STATUS_CHANGED
    ? await UserModel.find({ _id: app.student, isActive: true, role: { $in: ["STUDENT", "student"] } }).lean()
    : await UserModel.find({ company: app.company, isActive: true, role: { $in: ["RECRUITER", "recruiter"] } }).lean();
  if (type === DOMAIN_EVENTS.APPLICATION_STATUS_CHANGED && event.payload?.toStatus === "Selected" && app.institute) {
    const institute = await InstituteModel.findById(app.institute).lean();
    if (institute?.status === "active") {
      const officers = await UserModel.find({ institute: app.institute, isActive: true, role: { $in: ["PLACEMENT_OFFICER", "placement_officer"] } }).lean();
      recipients.push(...officers);
    }
  }
  return { recipients, entityType: "Application", entityId: id };
}

async function handleNotificationEvent(event, deps = {}) {
  const Model = deps.Notification || Notification;
  const template = templates[event.eventType];
  if (!template) return; // Compatibility events without a user-facing notification.
  const { recipients, entityType, entityId } = await resolveRecipients(event, deps);
  const operations = recipients.filter((u) => copy(u._id) !== copy(event.actor)).map((u) => ({
    updateOne: {
      filter: { recipientUser: u._id, sourceEventId: event._id },
      update: { $setOnInsert: { recipientUser: u._id, sourceEventId: event._id, type: event.eventType, title: template[0], message: template[1], entityType, entityId, actionPath: actionFor(event.eventType, u.role, entityId), readAt: null } },
      upsert: true,
    },
  }));
  if (operations.length) await Model.bulkWrite(operations, { ordered: false });
}

module.exports = { handleNotificationEvent, resolveRecipients, actionFor, templates, authorizedCompany, validJobChain };
