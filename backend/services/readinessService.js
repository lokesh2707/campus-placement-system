const mongoose = require("mongoose");
const StudentProfile = require("../models/StudentProfile");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const Job = require("../models/Job");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const { computeProfileCompletion } = require("../utils/profileCompletion");

const JOB_LIMIT = 300;
const AGGREGATE_JOB_LIMIT = 500;
const MIN_CELL_SIZE = 5;
const ALIASES = Object.freeze({
  "react.js": "react", node: "node.js", "express.js": "express", golang: "go",
  js: "javascript", ts: "typescript", postgres: "postgresql", k8s: "kubernetes",
});

const normalizeSkill = (value) => {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[normalized] || normalized;
};
const idOf = (value) => (value?._id || value ? String(value._id || value) : "");
const plain = (value) => (value?.toObject ? value.toObject() : value || {});

const safeInventoryItem = (item) => ({
  id: item._id ? String(item._id) : null,
  canonicalKey: item.canonicalKey,
  displayName: item.displayName,
  source: item.source,
  evidenceType: item.evidenceType,
  resumeAnalysisId: item.resumeAnalysis ? idOf(item.resumeAnalysis) : null,
  evidenceReference: item.evidenceReference || "",
  sourceCreatedAt: item.sourceCreatedAt || null,
  createdAt: item.createdAt || null,
  updatedAt: item.updatedAt || null,
  reviewStatus: item.reviewStatus,
  selfReportedProficiency: item.source === "student_declared" ? (item.selfReportedProficiency || "") : "",
});

const buildInventory = (profile, analyses = []) => {
  const current = Array.isArray(profile.skillInventory) ? profile.skillInventory.map(plain) : [];
  const entries = current.map(safeInventoryItem);
  const present = new Set(current.map((entry) => `${entry.source}|${entry.canonicalKey}|${idOf(entry.resumeAnalysis)}`));

  // Old profile strings and old analysis records are synthesized as DTO evidence;
  // this is a read-time compatibility layer, not an automatic live-data migration.
  for (const value of Array.isArray(profile.skills) ? profile.skills : []) {
    const canonicalKey = normalizeSkill(value);
    const key = `legacy_profile_skill|${canonicalKey}|`;
    if (!canonicalKey || present.has(key)) continue;
    entries.push({
      id: `legacy:${canonicalKey}`, canonicalKey, displayName: String(value).trim(),
      source: "legacy_profile_skill", evidenceType: "profile_skill", resumeAnalysisId: null,
      evidenceReference: "", sourceCreatedAt: null, reviewStatus: "source_unknown", selfReportedProficiency: "",
    });
    present.add(key);
  }

  for (const analysis of analyses) {
    for (const value of Array.isArray(analysis.extractedSkills) ? analysis.extractedSkills : []) {
      const canonicalKey = normalizeSkill(value);
      const analysisId = idOf(analysis._id);
      const key = `resume_extracted|${canonicalKey}|${analysisId}`;
      if (!canonicalKey || present.has(key)) continue;
      const review = current.find((entry) => entry.source === "resume_extracted" && entry.canonicalKey === canonicalKey && idOf(entry.resumeAnalysis) === analysisId);
      entries.push({
        id: review?._id ? String(review._id) : `resume:${analysisId}:${canonicalKey}`,
        canonicalKey, displayName: String(value).trim(), source: "resume_extracted", evidenceType: "resume_analysis",
        resumeAnalysisId: analysisId, evidenceReference: "", sourceCreatedAt: analysis.createdAt || null,
        reviewStatus: review?.reviewStatus || "extracted_unreviewed", selfReportedProficiency: "",
      });
      present.add(key);
    }
  }
  return entries;
};

const getStudentInstitute = async (user, profile) => {
  const userInstitute = idOf(user?.institute);
  const profileInstitute = idOf(profile?.institute);
  if (!userInstitute || !profileInstitute || userInstitute !== profileInstitute) {
    const error = new Error("Your institute association could not be verified.");
    error.statusCode = 403;
    throw error;
  }
  const institute = await Institute.findOne({ _id: profileInstitute, status: "active" }).select("_id").lean();
  if (!institute) {
    const error = new Error("Your assigned institute is inactive or unavailable.");
    error.statusCode = 403;
    throw error;
  }
  return institute;
};

const getRelevantJobs = async (instituteId, limit = JOB_LIMIT) => {
  const companies = await Company.find({
    isVerified: true,
    isActive: { $ne: false },
    authorizedInstitutes: instituteId,
  }).select("_id").limit(2000).lean();
  const companyIds = companies.map((company) => company._id);
  if (!companyIds.length) return { jobs: [], total: 0, truncated: false };
  const now = new Date();
  const filter = {
    status: "open",
    company: { $in: companyIds },
    $and: [
      { $or: [{ institute: null }, { institute: instituteId }] },
      { $or: [{ deadline: null }, { deadline: { $exists: false } }, { deadline: { $gt: now } }] },
    ],
  };
  const [jobs, total] = await Promise.all([
    Job.find(filter).select("title company institute requiredSkills preferredSkills deadline createdAt")
      .populate("company", "name")
      .sort({ createdAt: -1, _id: 1 }).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);
  return { jobs, total, truncated: total > jobs.length };
};

const makeDemand = (jobs) => {
  const skills = new Map();
  for (const job of jobs) {
    for (const [field, kind] of [["requiredSkills", "required"], ["preferredSkills", "preferred"]]) {
      for (const raw of Array.isArray(job[field]) ? job[field] : []) {
        const canonicalKey = normalizeSkill(raw);
        if (!canonicalKey) continue;
        if (!skills.has(canonicalKey)) skills.set(canonicalKey, {
          canonicalKey, displayName: String(raw).trim(), requiredJobCount: 0,
          preferredJobCount: 0, required: false, preferred: false, jobs: [],
          _requiredJobIds: new Set(), _preferredJobIds: new Set(),
        });
        const item = skills.get(canonicalKey);
        const countKey = kind === "required" ? "requiredJobCount" : "preferredJobCount";
        const flag = kind;
        const seenJobs = kind === "required" ? item._requiredJobIds : item._preferredJobIds;
        if (!seenJobs.has(String(job._id))) { item[countKey] += 1; seenJobs.add(String(job._id)); }
        item[flag] = true;
        if (!item.jobs.some((entry) => entry.jobId === String(job._id)) && item.jobs.length < 5) {
          item.jobs.push({ jobId: String(job._id), title: job.title, companyName: job.company?.name || "Company" });
        }
      }
    }
  }
  return Array.from(skills.values()).map(({ _requiredJobIds, _preferredJobIds, ...item }) => item).sort((a, b) =>
    (b.requiredJobCount + b.preferredJobCount) - (a.requiredJobCount + a.preferredJobCount) || a.displayName.localeCompare(b.displayName)
  );
};

const classifyResume = (profile, latest) => {
  if (!latest) return profile.resumeUrl ? "analysis_unavailable" : "not_uploaded";
  if (latest.isScanned || latest.status === "failed") return "scanned_unreadable";
  return ["parsed", "reviewed"].includes(latest.status) ? "parsed_readable" : "analysis_unavailable";
};

const buildEvidenceForSkill = (canonicalKey, inventory, analyses, latest, resumeStatus) => {
  const items = inventory.filter((item) => item.canonicalKey === canonicalKey);
  const latestId = idOf(latest?._id);
  const latestEntries = items.filter((item) => item.source === "resume_extracted" && item.resumeAnalysisId === latestId);
  const latestEntry = latestEntries.find((item) => item.reviewStatus !== "student_rejected");
  const latestRejected = latestEntries.some((item) => item.reviewStatus === "student_rejected");
  const declared = items.find((item) => item.source === "student_declared");
  const older = items.find((item) => item.source === "resume_extracted" && item.resumeAnalysisId !== latestId && item.reviewStatus !== "student_rejected");
  const unknown = items.find((item) => item.source === "legacy_profile_skill");
  let resumeEvidenceState;
  if (latestEntry) resumeEvidenceState = "found_in_latest_resume";
  else if (latestRejected) resumeEvidenceState = "needs_confirmation";
  else if (resumeStatus === "parsed_readable") resumeEvidenceState = "not_found_in_latest_resume";
  else if (resumeStatus === "scanned_unreadable") resumeEvidenceState = "resume_unreadable";
  else if (resumeStatus === "not_uploaded") resumeEvidenceState = "no_resume_available";
  else resumeEvidenceState = "needs_confirmation";

  let evidenceState = latestEntry ? "found_in_latest_resume"
    : declared ? "student_declared"
      : latestRejected ? "needs_confirmation"
      : older && resumeStatus === "parsed_readable" ? "not_found_in_latest_resume"
        : older ? "needs_confirmation"
          : unknown ? "source_unknown"
            : resumeEvidenceState;
  const allEvidence = items.map((item) => ({
    source: item.source,
    reviewStatus: item.reviewStatus,
    sourceCreatedAt: item.sourceCreatedAt,
    resumeAnalysisId: item.resumeAnalysisId || null,
    latest: item.source === "resume_extracted" && item.resumeAnalysisId === latestId,
  }));
  return {
    evidenceState,
    resumeEvidenceState,
    explanation: {
      found_in_latest_resume: "This skill appears in your latest parsed resume as keyword evidence, not verified proficiency.",
      student_declared: "You declared this skill in your profile. It has not been independently verified.",
      not_found_in_latest_resume: "This skill was not found in your latest readable resume. That does not mean you lack the skill.",
      needs_confirmation: latestRejected ? "You rejected this resume keyword match; it remains in the original parser record and is not treated as acknowledged evidence." : "Older evidence exists, but the latest resume could not be compared. Please review the source.",
      source_unknown: "This skill exists in an older profile record with unknown historical source.",
      no_resume_available: "No readable resume is available to compare this skill.",
      resume_unreadable: "The latest resume could not be read, so no conclusion can be drawn about this skill.",
    }[evidenceState],
    evidence: allEvidence,
  };
};

const buildStudentReadiness = async (user) => {
  const profileDoc = await StudentProfile.findOne({ user: user._id }).select("+skillInventory").lean();
  if (!profileDoc) {
    const error = new Error("Student profile not found."); error.statusCode = 404; throw error;
  }
  const institute = await getStudentInstitute(user, profileDoc);
  const analyses = await ResumeAnalysis.find({ user: user._id })
    .select("_id createdAt extractedSkills isScanned status")
    .sort({ createdAt: -1, _id: -1 }).limit(50).lean();
  const latest = analyses[0] || null;
  const resumeStatus = classifyResume(profileDoc, latest);
  const inventory = buildInventory(profileDoc, analyses);
  const { jobs, total, truncated } = await getRelevantJobs(institute._id);
  const demand = makeDemand(jobs);
  const gaps = demand.map((item) => {
    const evidence = buildEvidenceForSkill(item.canonicalKey, inventory, analyses, latest, resumeStatus);
    return {
      ...item,
      ...evidence,
      nextAction: evidence.evidenceState === "found_in_latest_resume" ? "Review the evidence in your latest resume."
        : evidence.evidenceState === "student_declared" ? "Add genuine project or resume evidence if you want to document this skill."
          : evidence.evidenceState === "not_found_in_latest_resume" ? "If you have this skill, confirm it or add genuine evidence to your profile or resume."
            : "Review or update the available skill evidence when convenient.",
    };
  });
  const completion = computeProfileCompletion(profileDoc);
  const isPresent = (value) => value !== undefined && value !== null && value !== "";
  const declaredCount = inventory.filter((item) => item.source === "student_declared").length;
  const extractedCount = inventory.filter((item) => item.source === "resume_extracted").length;
  const legacyCount = inventory.filter((item) => item.source === "legacy_profile_skill").length;
  const reviewCount = inventory.filter((item) => ["extracted_unreviewed", "needs_review", "source_unknown"].includes(item.reviewStatus)).length;

  return {
    checklist: {
      profile: { complete: completion.isComplete, missingInformation: completion.missingFields },
      resume: {
        state: resumeStatus,
        latestAnalysisAt: latest?.createdAt || null,
        latestAnalysisId: latest?._id ? String(latest._id) : null,
        olderResumeEvidenceAvailable: analyses.length > 1,
        historySampleCapped: analyses.length === 50,
      },
      skillInventory: { studentDeclared: declaredCount, resumeExtracted: extractedCount, legacyUnknown: legacyCount, needsReview: reviewCount },
      academics: {
        values: {
          cgpa: profileDoc.cgpa ?? null, department: profileDoc.department || null,
          batch: profileDoc.batch ?? null, backlogs: profileDoc.backlogs ?? null,
        },
        present: {
          cgpa: isPresent(profileDoc.cgpa), department: isPresent(profileDoc.department),
          batch: isPresent(profileDoc.batch), backlogs: isPresent(profileDoc.backlogs),
        },
        provenance: "Recorded profile values; the inspected system does not attach transcript verification.",
      },
    },
    skillInventory: inventory,
    opportunityDemand: {
      currentOpenJobCount: total,
      returnedJobCount: jobs.length,
      truncated,
      skills: gaps.slice(0, 50),
      disclaimer: "Resume keyword evidence and student declarations do not establish proficiency. A missing keyword does not mean you lack the skill.",
    },
  };
};

const ensureResumeSkillEntries = async (profileId, analysis) => {
  const skills = Array.isArray(analysis.extractedSkills) ? analysis.extractedSkills : [];
  for (const displayName of skills) {
    const canonicalKey = normalizeSkill(displayName);
    if (!canonicalKey) continue;
    const row = {
      canonicalKey, displayName: String(displayName).trim(), source: "resume_extracted", evidenceType: "resume_analysis",
      resumeAnalysis: analysis._id, evidenceReference: String(analysis._id), sourceCreatedAt: analysis.createdAt || new Date(),
      reviewStatus: "extracted_unreviewed", selfReportedProficiency: "",
    };
    await StudentProfile.updateOne({
      _id: profileId,
      skillInventory: { $not: { $elemMatch: { source: "resume_extracted", canonicalKey, resumeAnalysis: analysis._id } } },
    }, { $push: { skillInventory: row } });
  }
};

const syncResumeAnalysisIntoInventory = async (profileId, analysis) => {
  const skills = Array.isArray(analysis.extractedSkills) ? analysis.extractedSkills : [];
  await StudentProfile.updateOne({ _id: profileId }, {
    $addToSet: { skills: { $each: skills } },
    $set: { resumeUrl: analysis.storedFileName, resumeFileName: analysis.originalFileName, resumeFileSize: analysis.fileSize, resumeUpdatedAt: analysis.createdAt || new Date() },
  });
  await ensureResumeSkillEntries(profileId, analysis);
};

const updateDeclaration = async ({ profileId, declarationId, skillName, proficiency }) => {
  if (typeof skillName !== "string") {
    const error = new Error("skillName must be a string."); error.statusCode = 400; throw error;
  }
  const canonicalKey = normalizeSkill(skillName);
  const cleanName = String(skillName || "").trim();
  if (!cleanName || cleanName.length > 80 || !canonicalKey) {
    const error = new Error("skillName must be a non-empty string of at most 80 characters."); error.statusCode = 400; throw error;
  }
  const allowedProficiency = ["", "beginner", "intermediate", "advanced"];
  if (proficiency !== undefined && !allowedProficiency.includes(proficiency)) {
    const error = new Error("selfReportedProficiency must be beginner, intermediate, advanced, or empty."); error.statusCode = 400; throw error;
  }
  const entryFields = {
    canonicalKey, displayName: cleanName, source: "student_declared", evidenceType: "student_declaration",
    evidenceReference: "", sourceCreatedAt: new Date(), reviewStatus: "declared", selfReportedProficiency: proficiency || "",
  };

  if (declarationId) {
    if (!mongoose.Types.ObjectId.isValid(declarationId)) {
      const error = new Error("Invalid declarationId."); error.statusCode = 400; throw error;
    }
    const updated = await StudentProfile.updateOne({
      _id: profileId,
      skillInventory: { $elemMatch: { _id: declarationId, source: "student_declared" } },
      $and: [
        { skillInventory: { $not: { $elemMatch: { source: "student_declared", canonicalKey, _id: { $ne: new mongoose.Types.ObjectId(declarationId) } } } } },
      ],
    }, {
      $set: {
        "skillInventory.$[item].canonicalKey": canonicalKey,
        "skillInventory.$[item].displayName": cleanName,
        "skillInventory.$[item].reviewStatus": "declared",
        "skillInventory.$[item].selfReportedProficiency": proficiency || "",
        "skillInventory.$[item].updatedAt": new Date(),
      },
      $addToSet: { skills: cleanName },
    }, { arrayFilters: [{ "item._id": new mongoose.Types.ObjectId(declarationId), "item.source": "student_declared" }] });
    if (!updated.modifiedCount) {
      const exists = await StudentProfile.exists({ _id: profileId, skillInventory: { $elemMatch: { _id: declarationId, source: "student_declared" } } });
      const error = new Error(exists ? "A declaration for this canonical skill already exists." : "Declaration not found."); error.statusCode = exists ? 409 : 404; throw error;
    }
  } else {
    const inserted = await StudentProfile.updateOne({
      _id: profileId,
      skillInventory: { $not: { $elemMatch: { source: "student_declared", canonicalKey } } },
    }, { $push: { skillInventory: entryFields }, $addToSet: { skills: cleanName } });
    if (!inserted.modifiedCount) {
      const duplicate = await StudentProfile.updateOne({
        _id: profileId,
        skillInventory: { $elemMatch: { source: "student_declared", canonicalKey } },
      }, {
        $set: {
          "skillInventory.$.displayName": cleanName,
          "skillInventory.$.reviewStatus": "declared",
          "skillInventory.$.selfReportedProficiency": proficiency || "",
          "skillInventory.$.updatedAt": new Date(),
        },
        $addToSet: { skills: cleanName },
      });
      if (!duplicate.matchedCount) {
        const error = new Error("Student profile not found."); error.statusCode = 404; throw error;
      }
    }
  }
  return getDeclarationDTO(profileId, canonicalKey);
};

const getDeclarationDTO = async (profileId, canonicalKey) => {
  const profile = await StudentProfile.findById(profileId).select("+skillInventory").lean();
  const entry = profile?.skillInventory?.find((item) => item.source === "student_declared" && item.canonicalKey === canonicalKey);
  return entry ? safeInventoryItem(entry) : null;
};

const removeDeclaration = async (profileId, declarationId) => {
  if (!mongoose.Types.ObjectId.isValid(declarationId)) {
    const error = new Error("Invalid declarationId."); error.statusCode = 400; throw error;
  }
  const target = await StudentProfile.findOne({ _id: profileId, "skillInventory._id": declarationId })
    .select("+skillInventory")
    .lean();
  const item = target?.skillInventory?.find((entry) => String(entry._id) === String(declarationId));
  if (!item) { const error = new Error("Declaration not found."); error.statusCode = 404; throw error; }
  if (item.source !== "student_declared") { const error = new Error("Only student-declared skills may be removed."); error.statusCode = 403; throw error; }
  const result = await StudentProfile.updateOne({ _id: profileId, skillInventory: { $elemMatch: { _id: new mongoose.Types.ObjectId(declarationId), source: "student_declared" } } }, {
    $pull: { skillInventory: { _id: new mongoose.Types.ObjectId(declarationId), source: "student_declared" } },
  });
  if (!result.matchedCount) {
    const exists = await StudentProfile.exists({ _id: profileId });
    const error = new Error(exists ? "Declaration not found." : "Student profile not found.");
    error.statusCode = 404;
    throw error;
  }
  // Deliberately retain the legacy flat skill string: older resumes and legacy
  // records have indistinguishable provenance, so removing it could change a
  // prior matching result or erase evidence that belongs to another source.
};

const applyResumeSkillReview = async (profileId, analysis, chosenSkills) => {
  await ensureResumeSkillEntries(profileId, analysis);
  const chosen = new Set((chosenSkills || []).map(normalizeSkill).filter(Boolean));
  for (const raw of Array.isArray(analysis.extractedSkills) ? analysis.extractedSkills : []) {
    const canonicalKey = normalizeSkill(raw);
    if (!canonicalKey) continue;
    await StudentProfile.updateOne({
      _id: profileId,
      skillInventory: { $elemMatch: { source: "resume_extracted", canonicalKey, resumeAnalysis: analysis._id } },
    }, {
      $set: { "skillInventory.$[item].reviewStatus": chosen.has(canonicalKey) ? "student_confirmed" : "student_rejected", "skillInventory.$[item].updatedAt": new Date() },
    }, { arrayFilters: [{ "item.source": "resume_extracted", "item.canonicalKey": canonicalKey, "item.resumeAnalysis": analysis._id }] });
  }
  const original = new Set((analysis.extractedSkills || []).map(normalizeSkill));
  for (const skillName of chosenSkills || []) {
    if (!original.has(normalizeSkill(skillName))) {
      await updateDeclaration({ profileId, skillName, proficiency: "" });
    }
  }
};

const safeCount = (value) => value > 0 && value < MIN_CELL_SIZE ? null : value;
const buildInstituteSummary = async ({ instituteId = null } = {}) => {
  let instituteFilter = {};
  let institute = null;
  if (instituteId) {
    institute = await Institute.findOne({ _id: instituteId, status: "active" }).select("_id name code").lean();
    if (!institute) { const error = new Error("Active institute not found."); error.statusCode = 404; throw error; }
    instituteFilter = { institute: institute._id };
  } else {
    const ids = await Institute.find({ status: "active" }).select("_id").limit(1000).lean();
    instituteFilter = { institute: { $in: ids.map((item) => item._id) } };
  }
  const [studentStatsRows, activeInstitutes] = await Promise.all([
    StudentProfile.aggregate([
      { $match: instituteFilter },
      { $lookup: {
        from: "resumeanalyses",
        let: { profileId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$studentProfile", "$$profileId"] },
            { $gt: [{ $size: { $ifNull: ["$extractedSkills", []] } }, 0] },
          ] } } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "resumeSkillEvidence",
      } },
      { $project: {
        hasResume: { $cond: [{ $and: [{ $ne: ["$resumeUrl", null] }, { $ne: ["$resumeUrl", ""] }] }, 1, 0] },
        hasLegacySkills: { $cond: [{ $gt: [{ $size: { $ifNull: ["$skills", []] } }, 0] }, 1, 0] },
        hasDeclared: { $cond: [{ $gt: [{ $size: { $filter: { input: { $ifNull: ["$skillInventory", []] }, as: "item", cond: { $eq: ["$$item.source", "student_declared"] } } } }, 0] }, 1, 0] },
        hasResumeExtracted: { $cond: [{ $or: [
          { $gt: [{ $size: { $filter: { input: { $ifNull: ["$skillInventory", []] }, as: "item", cond: { $eq: ["$$item.source", "resume_extracted"] } } } }, 0] },
          { $gt: [{ $size: "$resumeSkillEvidence" }, 0] },
        ] }, 1, 0] },
        hasUnknown: { $cond: [{ $gt: [{ $size: { $filter: { input: { $ifNull: ["$skillInventory", []] }, as: "item", cond: { $eq: ["$$item.source", "legacy_profile_skill"] } } } }, 0] }, 1, 0] },
        hasAcademics: { $cond: [{ $and: [{ $ne: ["$cgpa", null] }, { $ne: ["$department", ""] }, { $ne: ["$batch", null] }, { $ne: ["$backlogs", null] }] }, 1, 0] },
      } },
      { $group: { _id: null, totalStudents: { $sum: 1 }, withResume: { $sum: "$hasResume" }, withLegacySkills: { $sum: "$hasLegacySkills" }, withDeclared: { $sum: "$hasDeclared" }, withResumeExtracted: { $sum: "$hasResumeExtracted" }, withUnknown: { $sum: "$hasUnknown" }, withAcademicFields: { $sum: "$hasAcademics" } } },
    ]),
    Institute.find({ status: "active" }).select("_id").limit(1000).lean(),
  ]);
  const stats = studentStatsRows[0] || { totalStudents: 0, withResume: 0, withLegacySkills: 0, withDeclared: 0, withResumeExtracted: 0, withUnknown: 0, withAcademicFields: 0 };
  if (stats.totalStudents > 0 && stats.totalStudents < MIN_CELL_SIZE) {
    return { scope: institute ? { type: "institute", instituteId: String(institute._id), instituteName: institute.name } : { type: "platform" }, suppressed: true, minimumCellSize: MIN_CELL_SIZE, message: "Aggregate details are suppressed because the group is smaller than the privacy threshold." };
  }
  const activeInstituteIds = institute ? [institute._id] : activeInstitutes.map((item) => item._id);
  const lookupPipeline = [
    { $match: { status: "open", $or: [{ deadline: null }, { deadline: { $exists: false } }, { deadline: { $gt: new Date() } }] } },
    { $lookup: { from: "companies", localField: "company", foreignField: "_id", as: "companyData" } },
    { $unwind: "$companyData" },
    { $match: { "companyData.isVerified": true, "companyData.isActive": { $ne: false } } },
    ...(institute ? [
      { $match: { "companyData.authorizedInstitutes": institute._id, $or: [{ institute: null }, { institute: institute._id }] } },
    ] : [
      { $match: { $expr: { $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$companyData.authorizedInstitutes", []] }, activeInstituteIds] } }, 0] } } },
      { $match: { $expr: { $or: [
        { $eq: [{ $ifNull: ["$institute", null] }, null] },
        { $in: ["$institute", { $setIntersection: [{ $ifNull: ["$companyData.authorizedInstitutes", []] }, activeInstituteIds] }] },
      ] } } },
    ]),
    { $sort: { createdAt: -1, _id: 1 } },
  ];
  const [jobs, jobCountRows] = await Promise.all([
    Job.aggregate([...lookupPipeline, { $limit: AGGREGATE_JOB_LIMIT }, { $project: { title: 1, company: { name: "$companyData.name" }, requiredSkills: 1, preferredSkills: 1 } }]),
    Job.aggregate([...lookupPipeline, { $count: "count" }]),
  ]);
  const demand = makeDemand(jobs);
  const breakdown = (value) => ({ count: safeCount(value), suppressed: value > 0 && value < MIN_CELL_SIZE });
  return {
    scope: institute ? { type: "institute", instituteId: String(institute._id), instituteName: institute.name, instituteCode: institute.code } : { type: "platform" },
    suppressed: false,
    minimumCellSize: MIN_CELL_SIZE,
    studentCount: stats.totalStudents,
    profileCoverage: {
      profilesWithResume: breakdown(stats.withResume),
      profilesWithAcademicFields: breakdown(stats.withAcademicFields),
    },
    skillSourceDistribution: {
      profilesWithStudentDeclaredSkills: breakdown(stats.withDeclared),
      profilesWithResumeExtractedSkills: breakdown(stats.withResumeExtracted),
      profilesWithLegacyFlatSkillsOfUnknownProvenance: breakdown(stats.withLegacySkills),
      profilesWithLegacyUnknownInventoryItems: breakdown(stats.withUnknown),
      note: "Counts are profiles with records, not verified proficiency; legacy flat values may overlap other sources.",
    },
    opportunityDemand: {
      evaluatedJobCount: jobs.length,
      totalRelevantOpenJobs: jobCountRows[0]?.count || 0,
      capped: (jobCountRows[0]?.count || 0) > jobs.length,
      requiredSkills: demand.filter((skill) => skill.required).slice(0, 10).map(({ canonicalKey, displayName, requiredJobCount }) => ({ canonicalKey, displayName, jobCount: requiredJobCount })),
      preferredSkills: demand.filter((skill) => skill.preferred).slice(0, 10).map(({ canonicalKey, displayName, preferredJobCount }) => ({ canonicalKey, displayName, jobCount: preferredJobCount })),
    },
    verificationNote: "Profile data is recorded/self-reported. This aggregate does not measure proficiency or predict placement.",
  };
};

module.exports = {
  JOB_LIMIT, AGGREGATE_JOB_LIMIT, MIN_CELL_SIZE, normalizeSkill, buildInventory,
  getStudentInstitute, getRelevantJobs, makeDemand, classifyResume, buildEvidenceForSkill,
  buildStudentReadiness, syncResumeAnalysisIntoInventory, updateDeclaration, removeDeclaration,
  ensureResumeSkillEntries, applyResumeSkillReview, buildInstituteSummary,
};
