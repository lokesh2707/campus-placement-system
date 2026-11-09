const mongoose = require("mongoose");
const Institute = require("../models/Institute");
const StudentProfile = require("../models/StudentProfile");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const { normalizeRole, ROLES } = require("../constants/roles");
const {
  buildStudentReadiness,
  buildInventory,
  updateDeclaration,
  removeDeclaration,
  buildInstituteSummary,
} = require("../services/readinessService");

const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  message: error.statusCode ? error.message : "Unable to load placement readiness.",
});

const getInventoryDTO = async (profileId, userId) => {
  const [profile, analyses] = await Promise.all([
    StudentProfile.findById(profileId).select("+skillInventory").lean(),
    ResumeAnalysis.find({ user: userId }).select("_id createdAt extractedSkills isScanned status")
      .sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
  ]);
  return buildInventory(profile, analyses);
};

const getMyReadiness = async (req, res) => {
  try {
    const readiness = await buildStudentReadiness(req.user);
    return res.status(200).json({ success: true, readiness });
  } catch (error) { return sendError(res, error); }
};

const updateMySkills = async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = body.action === "upsert"
      ? new Set(["action", "skillName", "selfReportedProficiency", "declarationId"])
      : new Set(["action", "declarationId"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      return res.status(400).json({ success: false, message: "Unsupported readiness skill field." });
    }
    const profile = await StudentProfile.findOne({ user: req.user._id }).select("_id").lean();
    if (!profile) return res.status(404).json({ success: false, message: "Student profile not found." });
    if (body.action === "upsert") {
      const item = await updateDeclaration({
        profileId: profile._id,
        declarationId: body.declarationId,
        skillName: body.skillName,
        proficiency: body.selfReportedProficiency,
      });
      const skillInventory = await getInventoryDTO(profile._id, req.user._id);
      return res.status(200).json({ success: true, skill: item, skillInventory });
    }
    if (body.action === "remove") {
      if (typeof body.declarationId !== "string") return res.status(400).json({ success: false, message: "declarationId is required." });
      await removeDeclaration(profile._id, body.declarationId);
      const skillInventory = await getInventoryDTO(profile._id, req.user._id);
      return res.status(200).json({ success: true, skillInventory });
    }
    return res.status(400).json({ success: false, message: "action must be upsert or remove." });
  } catch (error) { return sendError(res, error); }
};

const getInstituteReadinessSummary = async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    let instituteId = null;
    if (role === ROLES.PLACEMENT_OFFICER) {
      if (!req.user.institute) return res.status(403).json({ success: false, message: "Your account is not associated with an institute." });
      const institute = await Institute.findOne({ _id: req.user.institute, status: "active" }).select("_id").lean();
      if (!institute) return res.status(403).json({ success: false, message: "Your assigned institute is inactive or unavailable." });
      instituteId = institute._id;
      if (req.query.instituteId) return res.status(400).json({ success: false, message: "Placement Officers cannot override their assigned institute." });
    } else if (role === ROLES.SUPER_ADMIN) {
      if (req.query.instituteId && !mongoose.Types.ObjectId.isValid(req.query.instituteId)) {
        return res.status(400).json({ success: false, message: "Invalid instituteId." });
      }
      instituteId = req.query.instituteId || null;
    } else {
      return res.status(403).json({ success: false, message: "This role cannot access institute readiness aggregates." });
    }
    const summary = await buildInstituteSummary({ instituteId });
    return res.status(200).json({ success: true, summary });
  } catch (error) { return sendError(res, error); }
};

module.exports = { getMyReadiness, updateMySkills, getInstituteReadinessSummary };
