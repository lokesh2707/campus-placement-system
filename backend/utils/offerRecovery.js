const mongoose = require("mongoose");
const Application = require("../models/Application");
const Job = require("../models/Job");
const StudentProfile = require("../models/StudentProfile");
const Company = require("../models/Company");
const AdminAuditLog = require("../models/AdminAuditLog");
const User = require("../models/User");
const { ROLES, normalizeRole } = require("../constants/roles");

/**
 * Safely extracts string ObjectId from entity reference or populated object.
 */
const getEntityId = (entity) => {
  if (!entity) return null;
  if (typeof entity === "object" && entity._id) {
    return String(entity._id);
  }
  return String(entity);
};

/**
 * Helper to reliably resolve the authoritative institute ID for an application.
 * Fails closed if references conflict or cannot be determined.
 */
const getAuthoritativeInstituteId = (application) => {
  if (!application) return null;

  const appInst = getEntityId(application.institute);
  const profileInst = getEntityId(application.studentProfile?.institute);
  const studentInst = getEntityId(application.student?.institute);

  const candidates = [appInst, profileInst, studentInst].filter(Boolean);
  if (candidates.length === 0) return null;
  const first = candidates[0];
  const hasConflict = candidates.some((id) => id !== first);
  if (hasConflict) return null;

  return first;
};

/**
 * Strictly validates that the initiating actor persisted on the offer-resolution
 * operation exists in the database, is active, and possesses an authorized administrative
 * or recruiter role.
 *
 * Never falls back to the student or recovery process executor.
 *
 * @param {ObjectId|string} resolvedBy
 * @returns {Promise<{ valid: boolean, actor?: Object, category?: string }>}
 */
const validateInitiatingActor = async (resolvedBy, { resolutionStatus, application } = {}) => {
  const actorId = resolvedBy ? getEntityId(resolvedBy) : null;
  if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) {
    return { valid: false, category: "ACTOR_REFERENCE_INVALID" };
  }

  const actor = await User.findById(actorId).select("_id role isActive");
  if (!actor) {
    return { valid: false, category: "ACTOR_NOT_FOUND" };
  }

  if (!actor.isActive) {
    return { valid: false, category: "ACTOR_INACTIVE" };
  }

  const authorizedRoles = [ROLES.SUPER_ADMIN, ROLES.PLACEMENT_OFFICER, ROLES.RECRUITER];
  const actorRole = normalizeRole(actor.role);
  const studentDeclineActor = actorRole === ROLES.STUDENT
    && resolutionStatus === "Offer Declined"
    && getEntityId(application?.student) === actorId;
  if (!authorizedRoles.includes(actorRole) && !studentDeclineActor) {
    return { valid: false, category: "ACTOR_ROLE_INVALID" };
  }

  return { valid: true, actor };
};

/**
 * Executes the durable, idempotent side effects of an offer resolution operation:
 * 1. Release Job Vacancy Reservation (Idempotent $pull)
 * 2. Update StudentProfile placement status & outcome (Idempotent evaluation of remaining offers)
 * 3. Log AdminAuditLog record (Idempotent check by operationId)
 * 4. Transition durableState to COMPLETED
 *
 * @param {Object} appDoc - The Application document containing offerResolution details
 * @returns {Promise<Object>} Execution result
 */
const executeOfferResolutionSideEffectsUnsafe = async (appDoc) => {
  const application = await Application.findById(appDoc._id)
    .populate("job")
    .populate("studentProfile")
    .populate("student");

  if (!application) {
    throw new Error(`Application ${appDoc._id} not found during side effects execution`);
  }

  const op = application.offerResolution || {};
  const operationId = op.operationId;
  const resolutionStatus = op.resolutionStatus || application.status;
  const reason = op.reason || "";
  const resolvedBy = op.resolvedBy;
  const jobId = application.job?._id || application.job;

  // Validate initiating actor BEFORE executing side effects or writing audit logs
  const actorValidation = await validateInitiatingActor(resolvedBy, { resolutionStatus, application });
  if (!actorValidation.valid) {
    await Application.updateOne(
      { _id: application._id },
      {
        $set: {
          "offerResolution.actorError": actorValidation.category,
        },
      }
    );
    throw new Error("Offer resolution actor validation failed.");
  }

  const actor = actorValidation.actor;

  let vacancyReleased = false;

  // STEP 1: Release Vacancy Reservation (Idempotent via atomic $pull)
  if (!op.steps?.vacancyReleased) {
    if (jobId) {
      await Job.findByIdAndUpdate(jobId, {
        $pull: { selectedApplications: application._id },
      });
      vacancyReleased = true;
    }
    await Application.updateOne(
      { _id: application._id },
      { $set: { "offerResolution.steps.vacancyReleased": true } }
    );
  } else {
    vacancyReleased = true;
  }

  // STEP 2: Update StudentProfile Placement Status (Idempotent evaluation)
  let updatedProfile = null;
  const studentProfileId = application.studentProfile?._id || application.studentProfile;

  if (studentProfileId) {
    const profileDoc = await StudentProfile.findById(studentProfileId);
    if (profileDoc) {
      if (!op.steps?.profileUpdated) {
        // Inspect if the student has any other active Selected applications
        const otherSelectedApps = await Application.find({
          studentProfile: profileDoc._id,
          _id: { $ne: application._id },
          status: "Selected",
        }).populate("job", "title company");

        if (otherSelectedApps.length > 0) {
          // Candidate still has at least one other active on-campus offer
          if (
            profileDoc.placementOutcome?.application &&
            String(profileDoc.placementOutcome.application) === String(application._id)
          ) {
            // Re-link to the remaining active selected application
            const nextApp = otherSelectedApps[0];
            let compName = "On-Campus Employer";
            if (nextApp.job?.company) {
              const compDoc = await Company.findById(nextApp.job.company).select("name");
              if (compDoc) compName = compDoc.name;
            }
            profileDoc.placementOutcome.application = nextApp._id;
            profileDoc.placementOutcome.companyName = compName;
            profileDoc.placementOutcome.reason = `Offer re-linked after resolution of application ${application._id}`;
            await profileDoc.save();
          }
        } else {
          // No other active on-campus selections exist
          const hasAdminOutcome =
            profileDoc.placementOutcome &&
            [
              "off_campus",
              "higher_studies",
              "entrepreneurship",
              "competitive_exams",
              "administrative_override",
            ].includes(profileDoc.placementOutcome.source);

          if (!hasAdminOutcome) {
            profileDoc.placementStatus = "seeking";
            profileDoc.placementOutcome = {
              source: "none",
              companyName: "",
              application: null,
              recordedBy: actor._id,
              recordedAt: op.resolvedAt || new Date(),
              reason: `Offer resolved: ${resolutionStatus} (${reason})`,
            };
            await profileDoc.save();
          }
        }

        await Application.updateOne(
          { _id: application._id },
          { $set: { "offerResolution.steps.profileUpdated": true } }
        );
      }
      updatedProfile = profileDoc;
    }
  }

  // STEP 3: Create Audit Log (Atomic uniqueness enforced by unique sparse index on details.operationId)
  if (!op.steps?.auditLogged) {
    let auditRecord = null;
    if (operationId) {
      auditRecord = await AdminAuditLog.findOne({ "details.operationId": operationId });
    }

    if (!auditRecord) {
      const targetInst = getAuthoritativeInstituteId(application);
      try {
        auditRecord = await AdminAuditLog.create({
          action: "offer_resolution",
          performedBy: actor._id,
          targetUser: application.student?._id || application.student,
          targetInstitute: targetInst || undefined,
          targetCompany: application.company?._id || application.company || undefined,
          details: {
            operationId,
            applicationId: application._id,
            jobId,
            previousStatus: "Selected",
            resolutionStatus,
            reason,
            vacancyReleased: true,
            actorRole: actor.role,
          },
        });
      } catch (createErr) {
        // Handle duplicate-key error E11000
        const isDuplicateKey =
          createErr.code === 11000 ||
          createErr.codeName === "DuplicateKey" ||
          (createErr.message && createErr.message.includes("E11000 duplicate key"));

        if (isDuplicateKey) {
          // Check whether the duplicate key violation is specifically on details.operationId
          const isOpIdDuplicate =
            (createErr.keyPattern && createErr.keyPattern["details.operationId"]) ||
            (createErr.keyValue && createErr.keyValue["details.operationId"]) ||
            (createErr.message && createErr.message.includes("details.operationId"));

          if (!isOpIdDuplicate) {
            // Unrelated duplicate key error: do NOT treat as successful audit completion
            throw createErr;
          }

          // Fetch the existing audit record using the operationId
          auditRecord = await AdminAuditLog.findOne({ "details.operationId": operationId });
        } else {
          // Other error: rethrow
          throw createErr;
        }
      }
    }

    // Verify that the existing/fetched audit record belongs to the same operation
    // and represents the expected resolution
    if (!auditRecord) {
      throw new Error(
        `Audit log record for operation ${operationId} could not be created or retrieved`
      );
    }

    const matchesOp = String(auditRecord.details?.operationId) === String(operationId);
    const matchesApp =
      String(auditRecord.details?.applicationId) === String(application._id);
    const matchesResolution =
      auditRecord.details?.resolutionStatus === resolutionStatus;
    const matchesAction = auditRecord.action === "offer_resolution";

    if (!matchesOp || !matchesApp || !matchesResolution || !matchesAction) {
      throw new Error(
        `Mismatched audit record detected for operationId ${operationId}: expected action=offer_resolution, app=${application._id}, resolution=${resolutionStatus}, but found action=${auditRecord.action}, app=${auditRecord.details?.applicationId}, resolution=${auditRecord.details?.resolutionStatus}`
      );
    }

    // Only then mark steps.auditLogged = true
    await Application.updateOne(
      { _id: application._id },
      { $set: { "offerResolution.steps.auditLogged": true } }
    );
  }

  // STEP 4: Confirm all side effects before marking durableState as COMPLETED
  const freshApp = await Application.findById(application._id);
  const steps = freshApp?.offerResolution?.steps || {};
  const allStepsConfirmed =
    steps.vacancyReleased === true &&
    steps.profileUpdated === true &&
    steps.auditLogged === true;

  if (!allStepsConfirmed) {
    throw new Error(
      `Cannot mark operation ${operationId} as COMPLETED: incomplete steps (vacancyReleased=${steps.vacancyReleased}, profileUpdated=${steps.profileUpdated}, auditLogged=${steps.auditLogged})`
    );
  }

  // Authoritatively confirm the matching audit record exists in the database
  if (operationId) {
    const verifiedAudit = await AdminAuditLog.findOne({
      "details.operationId": operationId,
      action: "offer_resolution",
      "details.applicationId": application._id,
      "details.resolutionStatus": resolutionStatus,
    });
    if (!verifiedAudit) {
      throw new Error(
        `Cannot mark operation ${operationId} as COMPLETED: matching audit log record not found in database`
      );
    }
  }

  // Mark Operation as COMPLETED
  await Application.updateOne(
    { _id: application._id },
    { $set: { "offerResolution.durableState": "COMPLETED" } }
  );

  const finalApp = await Application.findById(application._id);
  return {
    application: finalApp,
    studentProfile: updatedProfile,
    vacancyReleased,
  };
};

// Keep exception text, database values, and identifiers out of API responses and
// persisted recovery summaries. Detailed diagnostics belong in protected server
// observability, which this service deliberately does not write to MongoDB.
const executeOfferResolutionSideEffects = async (appDoc) => {
  try {
    return await executeOfferResolutionSideEffectsUnsafe(appDoc);
  } catch (_) {
    throw new Error("Offer resolution side effects failed.");
  }
};

/**
 * Scans for any Application documents where offerResolution.durableState === 'PENDING'
 * (e.g. from an interrupted operation or server restart) and safely drives their side effects
 * to completion idempotently.
 *
 * @returns {Promise<Object>} Summary of recovered operations
 */
const resumePendingOfferResolutions = async () => {
  const pendingApps = await Application.find({
    "offerResolution.durableState": "PENDING",
  });

  const results = [];
  for (const app of pendingApps) {
    try {
      const res = await executeOfferResolutionSideEffects(app);
      results.push({
        applicationId: app._id.toString(),
        operationId: app.offerResolution?.operationId,
        status: "COMPLETED",
        success: true,
      });
    } catch (err) {
      results.push({
        applicationId: app._id.toString(),
        operationId: app.offerResolution?.operationId,
        status: "FAILED",
        category: "SIDE_EFFECT_FAILED",
        success: false,
      });
    }
  }

  return {
    totalPending: pendingApps.length,
    recoveredCount: results.filter((r) => r.success).length,
    results,
  };
};

/** Resume only the durable resolution for a single application after a retry. */
const resumePendingOfferResolutionForApplication = async (applicationId) => {
  const app = await Application.findById(applicationId);
  if (!app || app.offerResolution?.durableState !== "PENDING") {
    return { resumed: false, application: app };
  }
  const result = await executeOfferResolutionSideEffects(app);
  return { resumed: true, ...result };
};

module.exports = {
  executeOfferResolutionSideEffects,
  resumePendingOfferResolutions,
  resumePendingOfferResolutionForApplication,
  validateInitiatingActor,
  getAuthoritativeInstituteId,
  getEntityId,
};
