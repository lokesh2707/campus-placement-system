const Job = require("../models/Job");
const StudentProfile = require("../models/StudentProfile");
const Application = require("../models/Application");
const Company = require("../models/Company");

/**
 * @desc   Get AI/ML-ranked job recommendations for logged-in student
 * @route  GET /api/recommendations/me
 * @access Protected (Student only)
 */
const getMyRecommendations = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({
      user: req.user._id,
    }).populate("user", "name email");

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Please complete your Student Profile to receive job recommendations.",
      });
    }

    // Retrieve active open jobs from verified companies only; exclude expired deadlines,
    // closed/unpublished, already-applied, and companies not authorized for student's institute.
    const { verifiedCompanyJobFilter } = require("../utils/verifiedJobs");
    const { isDeadlinePassed } = require("../utils/deadline");
    const verifiedFilter = await verifiedCompanyJobFilter();

    const appliedJobIds = await Application.find({
      student: req.user._id,
    }).distinct("job");

    let companyScope = {};
    if (studentProfile.institute) {
      const authorizedCompanyIds = await Company.find({
        isVerified: true,
        isActive: true,
        authorizedInstitutes: studentProfile.institute,
      }).distinct("_id");
      companyScope = {
        $or: [
          { company: { $in: authorizedCompanyIds } },
          { institute: studentProfile.institute },
        ],
      };
    }

    const openJobs = await Job.find({
      status: "open",
      ...verifiedFilter,
      ...(appliedJobIds.length ? { _id: { $nin: appliedJobIds } } : {}),
      ...companyScope,
    })
      .populate("company", "name location industry website isVerified authorizedInstitutes")
      .lean();

    const jobs = (openJobs || []).filter(
      (j) => !j.applicationDeadline || !isDeadlinePassed(j.applicationDeadline)
    );

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        recommendations: [],
        message: "No active eligible jobs currently available for recommendations.",
      });
    }

    // Call Python FastAPI ML Service (POST /recommend-jobs)
    const { mlServiceUrl, mlServiceHeaders } = require("../utils/mlClient");
    let mlResponse;
    try {
      mlResponse = await fetch(`${mlServiceUrl()}/recommend-jobs`, {
        method: "POST",
        headers: mlServiceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          student: studentProfile,
          jobs,
        }),
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: `Recommendation ML service is unavailable: ${err.message}`,
      });
    }

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        success: false,
        message: "Failed to compute job recommendations in ML service",
      });
    }

    const data = await mlResponse.json();

    res.status(200).json({
      success: true,
      count: data.count,
      recommendations: data.recommendations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get skill-gap analysis for a specific job
 * @route  GET /api/recommendations/jobs/:jobId/gap
 * @access Protected (Student only)
 */
const getJobSkillGap = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({
      user: req.user._id,
    }).lean();

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Please complete your Student Profile to view skill-gap analysis.",
      });
    }

    const job = await Job.findById(req.params.jobId)
      .populate("company", "name location industry website isVerified")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    if (!job.company || job.company.isVerified !== true) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found",
      });
    }

    // Call Python FastAPI ML Service (POST /skill-gap-analysis)
    const { mlServiceUrl, mlServiceHeaders } = require("../utils/mlClient");
    let mlResponse;
    try {
      mlResponse = await fetch(`${mlServiceUrl()}/skill-gap-analysis`, {
        method: "POST",
        headers: mlServiceHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          student: studentProfile,
          job,
        }),
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        message: `Skill-gap ML service is unavailable: ${err.message}`,
      });
    }

    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({
        success: false,
        message: "Failed to compute skill gap analysis",
      });
    }

    const gapData = await mlResponse.json();

    res.status(200).json({
      success: true,
      analysis: gapData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyRecommendations,
  getJobSkillGap,
};
