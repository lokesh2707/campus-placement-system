/**
 * Phase 4: Vacancy Reservation Reconciliation Script
 *
 * Capabilities:
 * - Scans Job documents and compares their `selectedApplications` reservation array
 *   against actual authoritative `Application` records with status === "Selected".
 * - Detects orphaned reservations (reservation exists on Job but application was never
 *   successfully marked "Selected" due to a server crash or save failure).
 * - Detects missing historical selections (application is "Selected" but missing from
 *   Job.selectedApplications because it was created prior to vacancy tracking).
 * - Flags over-capacity jobs (actual Selected applications exceed declared vacancies).
 * - Ensures 100% idempotency without duplicate ObjectIds or data corruption.
 * - Defaults to DRY-RUN mode (zero writes). Requires explicit `--apply` flag to commit changes.
 *
 * Usage:
 *   node backend/scripts/reconcileVacancies.js              # Dry-run on all jobs (safe, no writes)
 *   node backend/scripts/reconcileVacancies.js --dry-run    # Explicit dry-run on all jobs
 *   node backend/scripts/reconcileVacancies.js --apply      # Apply reconciliation to all jobs
 *   node backend/scripts/reconcileVacancies.js --jobId <id> # Dry-run on a single job
 *   node backend/scripts/reconcileVacancies.js --apply --jobId <id> # Apply to a single job
 */

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load backend environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const {
  reconcileJobVacancies,
  reconcileAllJobs,
} = require("../utils/vacancyReconciliation");

const parseArgs = () => {
  const args = process.argv.slice(2);
  let dryRun = true;
  let jobId = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--apply") {
      dryRun = false;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--jobId" || arg === "--job-id") {
      jobId = args[i + 1];
      i++;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node backend/scripts/reconcileVacancies.js [options]

Options:
  --dry-run       Audit vacancy reservations without writing changes (default)
  --apply         Apply reconciliation updates to Job.selectedApplications
  --jobId <id>    Audit or reconcile a specific Job ID only
  --help, -h      Display this help message
`);
      process.exit(0);
    }
  }

  return { dryRun, jobId };
};

const run = async () => {
  const { dryRun, jobId } = parseArgs();
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("================================================================================");
  console.log("             PHASE 4: VACANCY RESERVATION RECONCILIATION AUDIT                  ");
  console.log("================================================================================");
  console.log(` Mode:     ${dryRun ? "[DRY-RUN] (Read-only, no database modifications)" : "[APPLY] (Database writes ENABLED)"}`);
  console.log(` Scope:    ${jobId ? `Single Job: ${jobId}` : "All Jobs in Database"}`);
  console.log(` Database: ${mongoUri}`);
  console.log("--------------------------------------------------------------------------------\n");

  try {
    await mongoose.connect(mongoUri);
    console.log("[MongoDB] Connected successfully.\n");

    if (jobId) {
      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        console.error(`[Error] Invalid MongoDB ObjectId format for jobId: "${jobId}"`);
        process.exit(1);
      }

      const result = await reconcileJobVacancies(jobId, { dryRun });
      if (result.error) {
        console.error(`[Error] ${result.error}: ${jobId}`);
        process.exit(1);
      }

      console.log("Job Details:");
      console.log(`- ID:                  ${result.jobId}`);
      console.log(`- Title:               ${result.jobTitle}`);
      console.log(`- Declared Vacancies:  ${result.vacancies}`);
      console.log(`- Reserved Slots:      ${result.reservedCount}`);
      console.log(`- Authoritative Selected: ${result.actualSelectedCount}`);
      console.log(`- Orphaned Slots:      ${result.orphanedCount} ${result.orphanedCount > 0 ? JSON.stringify(result.orphanedIds) : ""}`);
      console.log(`- Missing Historical:  ${result.missingCount} ${result.missingCount > 0 ? JSON.stringify(result.missingIds) : ""}`);
      console.log(`- Over Capacity:       ${result.isOverCapacity ? "YES (ALERT)" : "NO"}`);
      console.log(`- Discrepancy Found:   ${result.hasDiscrepancy ? "YES" : "NO"}`);
      console.log(`- Status:              ${dryRun ? (result.hasDiscrepancy ? "NEEDS RECONCILIATION" : "IN SYNC") : (result.reconciled ? "RECONCILED" : "IN SYNC")}`);
    } else {
      const summary = await reconcileAllJobs({ dryRun });

      console.log("Scan Summary:");
      console.log(`- Total Jobs Scanned:        ${summary.totalJobsScanned}`);
      console.log(`- Jobs With Discrepancies:   ${summary.jobsWithDiscrepancies}`);
      console.log(`- Orphaned Slots Detected:   ${summary.totalOrphanedRemoved} ${dryRun ? "(would be cleared)" : "(cleared)"}`);
      console.log(`- Missing Historical Slots:  ${summary.totalMissingAdded} ${dryRun ? "(would be registered)" : "(registered)"}`);
      console.log(`- Over-Capacity Jobs:        ${summary.overCapacityJobs.length}`);

      if (summary.overCapacityJobs.length > 0) {
        console.log("\n[WARNING] Over-Capacity Jobs Detected:");
        summary.overCapacityJobs.forEach((job) => {
          console.log(`  * Job "${job.title}" (${job.jobId}): vacancies=${job.vacancies}, selected=${job.selectedCount}, excess=+${job.excess}`);
        });
      }

      if (summary.details.length > 0) {
        console.log("\nDiscrepancy Details:");
        summary.details.forEach((d) => {
          console.log(`  * [${d.jobId}] "${d.jobTitle}": vacancies=${d.vacancies}, reserved=${d.reservedCount}, actualSelected=${d.actualSelectedCount}, orphaned=${d.orphanedCount}, missing=${d.missingCount}`);
        });
      } else {
        console.log("\n[OK] All scanned jobs are in perfect consistency.");
      }
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log(`[Complete] ${dryRun ? "Dry-run audit completed safely. No database modifications were made." : "Reconciliation completed. Selected reservations updated."}`);
    console.log("================================================================================");
  } catch (err) {
    console.error("[Fatal Error]", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run();
}

module.exports = { run };
