const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const { resumePendingOfferResolutions } = require("./offerRecovery");

/**
 * Reconciles vacancy reservations for a specific job against actual application states.
 *
 * Requirements:
 * - Detects resolved applications still present in Job.selectedApplications.
 * - Detects selected applications missing their expected reservation.
 * - Detects duplicate or stale reservation references.
 * - Detects jobs whose reservation state conflicts with their vacancy capacity.
 * - Idempotent and does not silently overwrite valid recruitment decisions.
 * - Does not automatically release reservations based on ambiguous or incomplete application records.
 *
 * @param {string|mongoose.Types.ObjectId} jobId
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @returns {Promise<Object>}
 */
const reconcileJobVacancies = async (jobId, options = {}) => {
  const dryRun = options.dryRun === true;

  const job = await Job.findById(jobId);
  if (!job) {
    return { error: "Job not found", jobId };
  }

  // 1. First, resume any pending/interrupted offer resolutions
  if (!dryRun) {
    await resumePendingOfferResolutions();
  }

  // 2. Query all actual applications in the database for this job where status === "Selected"
  const selectedDocs = await Application.find({
    job: job._id,
    status: "Selected",
  }).select("_id");

  const actualSelectedMap = new Map();
  selectedDocs.forEach((doc) => {
    actualSelectedMap.set(doc._id.toString(), doc._id);
  });
  const actualSelectedIds = Array.from(actualSelectedMap.keys());

  // 3. Inspect currently recorded reservations on Job
  const rawReservations = job.selectedApplications || [];
  const reservedIdStrings = [];
  let duplicateCount = 0;
  const seenReserved = new Set();

  rawReservations.forEach((id) => {
    if (id) {
      const str = id.toString();
      if (seenReserved.has(str)) {
        duplicateCount++;
      } else {
        seenReserved.add(str);
        reservedIdStrings.push(str);
      }
    }
  });

  // 4. Query all application documents that match the reserved IDs
  const reservedDocs = await Application.find({
    _id: { $in: Array.from(seenReserved).map((id) => new mongoose.Types.ObjectId(id)) },
  }).select("_id job status");

  const reservedDocsMap = new Map();
  reservedDocs.forEach((doc) => {
    reservedDocsMap.set(doc._id.toString(), doc);
  });

  // 5. Categorize discrepancies
  const resolvedTerminalStatuses = [
    "Offer Declined",
    "Offer Revoked",
    "Withdrawn",
    "Rejected",
  ];

  const resolvedPresentIds = [];
  const staleNonExistentIds = [];
  const ambiguousIds = [];
  const validSelectedPresentIds = [];

  for (const idStr of seenReserved) {
    const doc = reservedDocsMap.get(idStr);
    if (!doc) {
      // Document does not exist in Application collection at all
      staleNonExistentIds.push(idStr);
    } else {
      const appJobStr = doc.job ? doc.job.toString() : null;
      if (!appJobStr || appJobStr !== job._id.toString()) {
        // Ambiguous: job reference does not match this job!
        // Rule: Do not automatically release reservations based on ambiguous records.
        ambiguousIds.push(idStr);
      } else if (resolvedTerminalStatuses.includes(doc.status)) {
        // Application definitively exists on this job and is in a resolved/terminal non-selected state
        resolvedPresentIds.push(idStr);
      } else if (doc.status === "Selected") {
        validSelectedPresentIds.push(idStr);
      } else {
        // In-progress stage (e.g. Interview/Applied) that somehow got in reservations
        resolvedPresentIds.push(idStr);
      }
    }
  }

  // Missing: Confirmed "Selected" applications that are NOT in reserved array
  const missingSelectedIds = actualSelectedIds.filter((id) => !seenReserved.has(id));

  // Capacity conflict evaluation
  const vacancies = job.vacancies || 1;
  const totalSelectedCount = actualSelectedIds.length;
  const isOverCapacity = totalSelectedCount > vacancies;
  const excess = isOverCapacity ? totalSelectedCount - vacancies : 0;

  const hasDiscrepancy =
    resolvedPresentIds.length > 0 ||
    missingSelectedIds.length > 0 ||
    staleNonExistentIds.length > 0 ||
    duplicateCount > 0;

  let applied = false;
  if (!dryRun && hasDiscrepancy) {
    // Build authoritative list:
    // All confirmed Selected applications + any ambiguous records (retained for safety)
    const authoritativeMap = new Map();
    selectedDocs.forEach((doc) => {
      authoritativeMap.set(doc._id.toString(), doc._id);
    });
    ambiguousIds.forEach((idStr) => {
      authoritativeMap.set(idStr, new mongoose.Types.ObjectId(idStr));
    });

    const authoritativeObjectIds = Array.from(authoritativeMap.values());
    await Job.updateOne(
      { _id: job._id },
      { $set: { selectedApplications: authoritativeObjectIds } }
    );
    applied = true;
  }

  const orphanedIds = [...resolvedPresentIds, ...staleNonExistentIds];
  const orphanedCount = orphanedIds.length;
  const missingCount = missingSelectedIds.length;
  const missingIds = missingSelectedIds;

  return {
    jobId: job._id.toString(),
    jobTitle: job.title,
    vacancies,
    reservedCount: rawReservations.length,
    actualSelectedCount: totalSelectedCount,
    orphanedCount,
    orphanedIds,
    missingCount,
    missingIds,
    resolvedPresentCount: resolvedPresentIds.length,
    resolvedPresentIds,
    missingSelectedCount: missingSelectedIds.length,
    missingSelectedIds,
    staleNonExistentCount: staleNonExistentIds.length,
    staleNonExistentIds,
    duplicateCount,
    ambiguousCount: ambiguousIds.length,
    ambiguousIds,
    isOverCapacity,
    excess,
    hasDiscrepancy,
    reconciled: applied || !hasDiscrepancy,
    dryRun,
  };
};

/**
 * Scans all jobs across the database and reconciles vacancy reservations.
 *
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=true]
 * @returns {Promise<Object>}
 */
const reconcileAllJobs = async (options = {}) => {
  const dryRun = options.dryRun !== false;

  // First resume any pending offer resolutions across the platform
  if (!dryRun) {
    await resumePendingOfferResolutions();
  }

  const jobs = await Job.find({}).select("_id title vacancies");
  const details = [];
  let totalResolvedRemoved = 0;
  let totalMissingAdded = 0;
  let totalStaleRemoved = 0;
  const overCapacityJobs = [];

  for (const job of jobs) {
    const result = await reconcileJobVacancies(job._id, { dryRun });
    if (result.hasDiscrepancy || result.isOverCapacity) {
      details.push(result);
    }
    totalResolvedRemoved += result.resolvedPresentCount;
    totalMissingAdded += result.missingSelectedCount;
    totalStaleRemoved += result.staleNonExistentCount;

    if (result.isOverCapacity) {
      overCapacityJobs.push({
        jobId: result.jobId,
        title: result.jobTitle,
        vacancies: result.vacancies,
        selectedCount: result.actualSelectedCount,
        excess: result.excess,
      });
    }
  }

  return {
    totalJobsScanned: jobs.length,
    jobsWithDiscrepancies: details.length,
    totalOrphanedRemoved: totalResolvedRemoved + totalStaleRemoved,
    totalResolvedRemoved,
    totalMissingAdded,
    totalStaleRemoved,
    overCapacityJobs,
    details,
    dryRun,
  };
};

module.exports = {
  reconcileJobVacancies,
  reconcileAllJobs,
};
