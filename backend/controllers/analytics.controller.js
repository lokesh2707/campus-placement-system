const mongoose = require("mongoose");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const StudentProfile = require("../models/StudentProfile");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const { buildCsv, sendCsvDownload, FORMULA_PREFIX } = require("../utils/csv");
const { ROLES, normalizeRole } = require("../constants/roles");

const sanitizeSegment = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  return FORMULA_PREFIX.test(str) ? `'${str}` : str;
};

const ACTIVE_APP_STATUSES = [
  "Applied",
  "Shortlisted",
  "Under Review",
  "Assessment",
  "Interview",
  "Selected",
];

/**
 * Resolve institute scope for analytics.
 * Placement Officers are locked to their institute.
 * Super Admin may optionally pass instituteId; omit for platform-wide.
 */
const resolveAnalyticsInstitute = async (user, requestedInstituteId) => {
  const role = normalizeRole(user.role);
  if (role === ROLES.SUPER_ADMIN || role === "admin") {
    if (requestedInstituteId) {
      if (!mongoose.Types.ObjectId.isValid(requestedInstituteId)) {
        const err = new Error("Invalid institute ID");
        err.statusCode = 400;
        throw err;
      }
      const institute = await Institute.findById(requestedInstituteId);
      if (!institute) {
        const err = new Error("Institute not found");
        err.statusCode = 404;
        throw err;
      }
      return institute;
    }
    return null; // platform-wide
  }

  if (!user.institute) {
    const err = new Error("Your account is not associated with any institute.");
    err.statusCode = 403;
    throw err;
  }
  const institute = await Institute.findById(user.institute);
  if (!institute || institute.status !== "active") {
    const err = new Error("Your assigned institute is inactive or does not exist.");
    err.statusCode = 403;
    throw err;
  }
  return institute;
};

/**
 * Metric definitions (see response.definitions):
 * - activeJobs: status === "open" AND company verified (+ deadline not used as closed)
 * - closedJobs: status === "closed"
 * - activeApplications: applications whose status is not Withdrawn / Offer Declined / Offer Revoked / Rejected
 * - selectedApplications: status === "Selected" (pipeline selection; not necessarily placed)
 * - placedStudents: unique StudentProfile with placementStatus === "placed"
 * - uniqueApplicants: distinct student ids among applications in scope
 */
const getPlacementOverview = async (req, res, next) => {
  try {
    const institute = await resolveAnalyticsInstitute(
      req.user,
      req.query?.instituteId
    );
    const {
      verifiedCompanyJobFilter,
    } = require("../utils/verifiedJobs");
    const verifiedFilter = await verifiedCompanyJobFilter();

    const profileMatch = institute ? { institute: institute._id } : {};
    const appMatch = institute ? { institute: institute._id } : {};

    const authorizedCompanyIds = institute
      ? await Company.find({
          authorizedInstitutes: institute._id,
          isVerified: true,
          isActive: true,
        }).distinct("_id")
      : [];

    let jobMatch = { ...verifiedFilter };
    if (institute) {
      jobMatch = {
        $and: [
          verifiedFilter,
          {
            $or: [
              { company: { $in: authorizedCompanyIds } },
              { institute: institute._id },
            ],
          },
        ],
      };
    }

    const closedJobMatch = institute
      ? {
          status: "closed",
          $or: [
            { institute: institute._id },
            { company: { $in: authorizedCompanyIds } },
          ],
        }
      : { status: "closed" };

    const studentRoleFilter = {
      role: { $in: [ROLES.STUDENT, "student"] },
      isActive: true,
      ...(institute ? { institute: institute._id } : {}),
    };
    const recruiterRoleFilter = {
      role: { $in: [ROLES.RECRUITER, "recruiter"] },
      isActive: true,
    };

    const [
      totalStudents,
      totalRecruiters,
      activeJobs,
      closedJobs,
      totalApplications,
      activeApplications,
      withdrawnApplications,
      selectedApplications,
      rejectedApplications,
      placedStudents,
      uniqueApplicantsAgg,
      totalInstitutes,
      verifiedCompanies,
      stageDistributionRaw,
      departmentStats,
      batchStats,
      instituteComparisons,
    ] = await Promise.all([
      User.countDocuments(studentRoleFilter),
      institute
        ? User.countDocuments({
            ...recruiterRoleFilter,
            company: { $in: authorizedCompanyIds },
          })
        : User.countDocuments(recruiterRoleFilter),
      Job.countDocuments({ status: "open", ...jobMatch }),
      Job.countDocuments(closedJobMatch),
      Application.countDocuments(appMatch),
      Application.countDocuments({
        ...appMatch,
        status: { $in: ACTIVE_APP_STATUSES },
      }),
      Application.countDocuments({ ...appMatch, status: "Withdrawn" }),
      Application.countDocuments({ ...appMatch, status: "Selected" }),
      Application.countDocuments({ ...appMatch, status: "Rejected" }),
      StudentProfile.countDocuments({
        ...profileMatch,
        placementStatus: "placed",
      }),
      Application.aggregate([
        { $match: appMatch },
        { $group: { _id: "$student" } },
        { $count: "count" },
      ]),
      Institute.countDocuments({ status: "active" }),
      Company.countDocuments({ isVerified: true, isActive: true }),
      Application.aggregate([
        { $match: appMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      StudentProfile.aggregate([
        { $match: profileMatch },
        {
          $group: {
            _id: "$department",
            total: { $sum: 1 },
            placed: {
              $sum: {
                $cond: [{ $eq: ["$placementStatus", "placed"] }, 1, 0],
              },
            },
            avgCgpa: { $avg: "$cgpa" },
          },
        },
        {
          $project: {
            department: "$_id",
            total: 1,
            placed: 1,
            avgCgpa: { $round: ["$avgCgpa", 2] },
            _id: 0,
          },
        },
        { $sort: { total: -1 } },
      ]),
      StudentProfile.aggregate([
        { $match: profileMatch },
        {
          $group: {
            _id: "$batch",
            total: { $sum: 1 },
            placed: {
              $sum: {
                $cond: [{ $eq: ["$placementStatus", "placed"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            batch: "$_id",
            total: 1,
            placed: 1,
            _id: 0,
          },
        },
        { $sort: { batch: -1 } },
      ]),
      // Institute-wise comparisons only for Super Admin platform view
      !institute
        ? StudentProfile.aggregate([
            {
              $group: {
                _id: "$institute",
                students: { $sum: 1 },
                placed: {
                  $sum: {
                    $cond: [{ $eq: ["$placementStatus", "placed"] }, 1, 0],
                  },
                },
              },
            },
            {
              $lookup: {
                from: "institutes",
                localField: "_id",
                foreignField: "_id",
                as: "inst",
              },
            },
            {
              $project: {
                instituteId: "$_id",
                instituteName: {
                  $ifNull: [{ $arrayElemAt: ["$inst.name", 0] }, "Unassigned"],
                },
                students: 1,
                placed: 1,
                _id: 0,
              },
            },
            { $sort: { students: -1 } },
            { $limit: 50 },
          ])
        : Promise.resolve([]),
    ]);

    const uniqueApplicants = uniqueApplicantsAgg[0]?.count || 0;
    const placementRate =
      totalStudents > 0
        ? parseFloat(((placedStudents / totalStudents) * 100).toFixed(1))
        : 0;

    const stageDistribution = {};
    stageDistributionRaw.forEach((item) => {
      stageDistribution[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      scope: institute
        ? {
            type: "institute",
            instituteId: institute._id,
            instituteName: institute.name,
            instituteCode: institute.code,
          }
        : { type: "platform" },
      definitions: {
        activeJobs:
          "Jobs with status open belonging to verified companies (institute-authorized when scoped).",
        activeApplications:
          "Applications not in Withdrawn, Offer Declined, Offer Revoked, or Rejected.",
        selectedApplications:
          "Applications with status Selected (pipeline selection; distinct from placementOutcome).",
        placedStudents:
          "Unique student profiles with placementStatus=placed.",
        uniqueApplicants: "Distinct student user ids with at least one application in scope.",
        eligibilityUsesBatch:
          "Job eligibility uses verified StudentProfile.batch, not resume graduationYear.",
      },
      data: {
        summary: {
          totalStudents,
          totalRecruiters,
          activeJobs,
          closedJobs,
          totalApplications,
          activeApplications,
          withdrawnApplications,
          selectedApplications,
          rejectedApplications,
          uniqueApplicants,
          placedStudents,
          placementRate,
          totalInstitutes: institute ? 1 : totalInstitutes,
          verifiedCompanies,
        },
        stageDistribution,
        departmentStats,
        batchStats,
        instituteComparisons,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getSkillAnalytics = async (req, res, next) => {
  try {
    const institute = await resolveAnalyticsInstitute(
      req.user,
      req.query?.instituteId
    );
    const {
      verifiedCompanyJobFilter: verifiedJobsMatch,
    } = require("../utils/verifiedJobs");
    const verifiedMatch = await verifiedJobsMatch();

    let jobMatch = { status: "open", ...verifiedMatch };
    if (institute) {
      const authorizedCompanyIds = await Company.find({
        authorizedInstitutes: institute._id,
        isVerified: true,
        isActive: true,
      }).distinct("_id");
      jobMatch = {
        status: "open",
        ...verifiedMatch,
        $or: [
          { company: { $in: authorizedCompanyIds } },
          { institute: institute._id },
        ],
      };
    }

    const profileMatch = institute ? { institute: institute._id } : {};

    const inDemandSkills = await Job.aggregate([
      { $match: jobMatch },
      { $unwind: "$requiredSkills" },
      {
        $group: {
          _id: { $toLower: "$requiredSkills" },
          label: { $first: "$requiredSkills" },
          demand: { $sum: 1 },
        },
      },
      { $sort: { demand: -1 } },
      { $limit: 10 },
      {
        $project: {
          skill: "$label",
          demand: 1,
          _id: 0,
        },
      },
    ]);

    const supplySkills = await StudentProfile.aggregate([
      { $match: profileMatch },
      { $unwind: "$skills" },
      {
        $group: {
          _id: { $toLower: "$skills" },
          label: { $first: "$skills" },
          supply: { $sum: 1 },
        },
      },
      { $sort: { supply: -1 } },
      { $limit: 10 },
      {
        $project: {
          skill: "$label",
          supply: 1,
          _id: 0,
        },
      },
    ]);

    const supplyMap = {};
    supplySkills.forEach((s) => {
      supplyMap[String(s.skill).toLowerCase()] = s.supply;
    });

    const skillGaps = inDemandSkills
      .map((d) => {
        const key = String(d.skill).toLowerCase();
        const supply = supplyMap[key] || 0;
        return {
          skill: d.skill,
          demand: d.demand,
          supply,
          gap: d.demand - supply,
        };
      })
      .sort((a, b) => b.gap - a.gap);

    res.status(200).json({
      success: true,
      data: {
        inDemandSkills,
        supplySkills,
        skillGaps,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const exportStudentsCsv = async (req, res, next) => {
  try {
    const institute = await resolveAnalyticsInstitute(
      req.user,
      req.query?.instituteId
    );
    const match = institute ? { institute: institute._id } : {};
    const profiles = await StudentProfile.find(match)
      .populate("user", "name email isActive")
      .sort({ batch: -1, department: 1 })
      .lean();

    const headers = [
      "name",
      "email",
      "rollNumber",
      "department",
      "batch",
      "cgpa",
      "placementStatus",
      "skills",
    ];
    const rows = profiles.map((p) => ({
      name: sanitizeSegment(p.user?.name),
      email: sanitizeSegment(p.user?.email),
      rollNumber: sanitizeSegment(p.rollNumber),
      department: sanitizeSegment(p.department),
      batch: p.batch ?? "",
      cgpa: p.cgpa ?? "",
      placementStatus: p.placementStatus || "",
      skills: Array.isArray(p.skills)
        ? p.skills.map(sanitizeSegment).join("; ")
        : "",
    }));
    const csv = buildCsv(headers, rows);
    sendCsvDownload(
      res,
      `${institute ? institute.code : "platform"}-students-analytics.csv`,
      csv
    );
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const exportPlacementsCsv = async (req, res, next) => {
  try {
    const institute = await resolveAnalyticsInstitute(
      req.user,
      req.query?.instituteId
    );
    const match = {
      placementStatus: "placed",
      ...(institute ? { institute: institute._id } : {}),
    };
    const profiles = await StudentProfile.find(match)
      .populate("user", "name email")
      .lean();

    const headers = [
      "name",
      "email",
      "rollNumber",
      "department",
      "batch",
      "placementSource",
      "companyName",
    ];
    const rows = profiles.map((p) => ({
      name: sanitizeSegment(p.user?.name),
      email: sanitizeSegment(p.user?.email),
      rollNumber: sanitizeSegment(p.rollNumber),
      department: sanitizeSegment(p.department),
      batch: p.batch ?? "",
      placementSource: sanitizeSegment(p.placementOutcome?.source || ""),
      companyName: sanitizeSegment(p.placementOutcome?.companyName || ""),
    }));
    const csv = buildCsv(headers, rows);
    sendCsvDownload(
      res,
      `${institute ? institute.code : "platform"}-placements-analytics.csv`,
      csv
    );
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Student self-analytics — own applications only.
 * @route GET /api/analytics/student/me
 */
const getStudentAnalytics = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const profile = await StudentProfile.findOne({ user: studentId }).lean();
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Complete your student profile to view analytics.",
      });
    }

    const { computeProfileCompletion } = require("../utils/profileCompletion");
    const completion = computeProfileCompletion(profile);

    const apps = await Application.find({ student: studentId })
      .populate({
        path: "job",
        select: "title status deadline company",
        populate: { path: "company", select: "name" },
      })
      .lean();

    const statusDistribution = {};
    let activeCount = 0;
    apps.forEach((a) => {
      statusDistribution[a.status] = (statusDistribution[a.status] || 0) + 1;
      if (ACTIVE_APP_STATUSES.includes(a.status)) activeCount++;
    });

    const now = new Date();
    const upcomingDeadlines = apps
      .filter(
        (a) =>
          a.job?.status === "open" &&
          a.job?.deadline &&
          new Date(a.job.deadline) >= now &&
          ACTIVE_APP_STATUSES.includes(a.status)
      )
      .map((a) => ({
        jobId: a.job._id,
        title: a.job.title,
        companyName: a.job.company?.name,
        deadline: a.job.deadline,
        status: a.status,
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 10);

    // Also surface open jobs with upcoming deadlines the student has NOT applied to (from open list briefly)
    const appliedJobIds = new Set(apps.map((a) => String(a.job?._id || a.job)));
    const {
      verifiedCompanyJobFilter,
    } = require("../utils/verifiedJobs");
    const verifiedFilter = await verifiedCompanyJobFilter();
    const openJobs = await Job.find({
      status: "open",
      ...verifiedFilter,
      deadline: { $gte: now },
    })
      .select("title deadline company")
      .populate("company", "name")
      .sort({ deadline: 1 })
      .limit(20)
      .lean();

    const upcomingOpenDeadlines = openJobs
      .filter((j) => !appliedJobIds.has(String(j._id)))
      .slice(0, 5)
      .map((j) => ({
        jobId: j._id,
        title: j.title,
        companyName: j.company?.name,
        deadline: j.deadline,
        applied: false,
      }));

    res.status(200).json({
      success: true,
      definitions: {
        applicationCount: "All applications by this student including withdrawn.",
        activeApplications: "Excludes Withdrawn, Rejected, Offer Declined, Offer Revoked.",
        profileCompletion: "Computed checklist percentage from StudentProfile fields.",
      },
      data: {
        applicationCount: apps.length,
        activeApplications: activeCount,
        statusDistribution,
        upcomingDeadlines,
        upcomingOpenDeadlines,
        profileCompletion: completion,
        placementStatus: profile.placementStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlacementOverview,
  getSkillAnalytics,
  exportStudentsCsv,
  exportPlacementsCsv,
  getStudentAnalytics,
};
