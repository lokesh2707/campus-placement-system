const mongoose = require("mongoose");
const Company = require("../models/Company");
const Job = require("../models/Job");
const Application = require("../models/Application");
const User = require("../models/User");

/**
 * Helper: ensure authenticated user is an authorized recruiter with assigned company
 */
const getRecruiterCompanyId = (user) => {
  if (!user.company) {
    const err = new Error("Your recruiter account is not assigned to any authorized company.");
    err.statusCode = 403;
    throw err;
  }
  return user.company;
};

/**
 * @desc   Get recruiter's assigned company profile
 * @route  GET /api/recruiter/company
 * @access Recruiter only
 */
const getRecruiterCompany = async (req, res, next) => {
  try {
    const companyId = getRecruiterCompanyId(req.user);
    const company = await Company.findById(companyId)
      .populate("authorizedInstitutes", "name code city state")
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Assigned company not found",
      });
    }

    const [jobCount, applicantCount, colleaguesCount] = await Promise.all([
      Job.countDocuments({ company: company._id }),
      Application.countDocuments({ company: company._id }),
      User.countDocuments({ company: company._id, _id: { $ne: req.user._id } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...company,
        stats: {
          jobs: jobCount,
          applicants: applicantCount,
          colleagues: colleaguesCount,
          authorizedInstitutesCount: company.authorizedInstitutes ? company.authorizedInstitutes.length : 0,
        },
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Get jobs belonging strictly to the recruiter's company (IDOR protected)
 * @route  GET /api/recruiter/jobs
 * @access Recruiter only
 */
const getRecruiterJobs = async (req, res, next) => {
  try {
    const companyId = getRecruiterCompanyId(req.user);

    const jobs = await Job.find({ company: companyId })
      .populate("company", "name industry location isVerified")
      .populate("postedBy", "name email")
      .sort({ createdAt: -1 });

    const jobIds = jobs.map((j) => j._id);
    const counts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[c._id.toString()] = c.count;
    });

    const enriched = jobs.map((j) => ({
      ...j.toObject(),
      applicationCount: countMap[j._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Get applications submitted for the recruiter's company (IDOR protected)
 * @route  GET /api/recruiter/applications
 * @access Recruiter only
 */
const getRecruiterApplications = async (req, res, next) => {
  try {
    const companyId = getRecruiterCompanyId(req.user);

    const filter = { company: companyId };
    if (req.query.jobId && mongoose.Types.ObjectId.isValid(req.query.jobId)) {
      filter.job = req.query.jobId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const applications = await Application.find(filter)
      .populate("student", "name email")
      .populate(
        "studentProfile",
        "rollNumber department batch cgpa skills resumeUrl phone"
      )
      .populate("job", "title location employmentType status")
      .populate("resume", "originalFileName storedFileName fileSize extractedSkills isScanned createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc   Get aggregated metrics for recruiter's company
 * @route  GET /api/recruiter/overview
 * @access Recruiter only
 */
const getRecruiterOverview = async (req, res, next) => {
  try {
    const companyId = getRecruiterCompanyId(req.user);

    const companyOid = new mongoose.Types.ObjectId(companyId.toString());
    const [
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      activeApplications,
      stageAggregates,
      eligibilityAggregates,
      perJobAggregates,
    ] = await Promise.all([
      Job.countDocuments({ company: companyId }),
      Job.countDocuments({ company: companyId, status: "open" }),
      Job.countDocuments({ company: companyId, status: "closed" }),
      Application.countDocuments({ company: companyId }),
      Application.countDocuments({
        company: companyId,
        status: {
          $in: [
            "Applied",
            "Shortlisted",
            "Under Review",
            "Assessment",
            "Interview",
            "Selected",
          ],
        },
      }),
      Application.aggregate([
        { $match: { company: companyOid } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        { $match: { company: companyOid } },
        {
          $group: {
            _id: {
              $ifNull: ["$aiEvaluation.eligibilityStatus", "Unevaluated"],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Application.aggregate([
        { $match: { company: companyOid } },
        {
          $group: {
            _id: "$job",
            applicants: { $sum: 1 },
            shortlisted: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      ["Shortlisted", "Under Review", "Assessment"],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            interview: {
              $sum: { $cond: [{ $eq: ["$status", "Interview"] }, 1, 0] },
            },
            selected: {
              $sum: { $cond: [{ $eq: ["$status", "Selected"] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const stages = {};
    stageAggregates.forEach((item) => {
      stages[item._id] = item.count;
    });

    const eligibilityDistribution = {};
    eligibilityAggregates.forEach((item) => {
      eligibilityDistribution[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      definitions: {
        openJobs: "Company jobs with status open.",
        activeApplications:
          "Company applications excluding Withdrawn, Rejected, Offer Declined, Offer Revoked.",
        selected: "status=Selected (pipeline); not the same as student placementStatus=placed.",
      },
      data: {
        totalJobs,
        openJobs,
        closedJobs,
        totalApplications,
        activeApplications,
        stages,
        eligibilityDistribution,
        shortlisted: stages.Shortlisted || 0,
        interview: stages.Interview || 0,
        selected: stages.Selected || 0,
        rejected: stages.Rejected || 0,
        applicantsPerJob: perJobAggregates.map((row) => ({
          jobId: row._id,
          applicants: row.applicants,
          shortlisted: row.shortlisted,
          interview: row.interview,
          selected: row.selected,
          rejected: row.rejected,
        })),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getRecruiterCompany,
  getRecruiterJobs,
  getRecruiterApplications,
  getRecruiterOverview,
};
