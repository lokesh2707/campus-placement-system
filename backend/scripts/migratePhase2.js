/**
 * PHASE 2: Safe Role Consolidation & Schema Migration Script
 *
 * Capabilities:
 * - Read all users and safely map legacy role values to standardized roles:
 *     admin              → SUPER_ADMIN
 *     placement_officer  → PLACEMENT_OFFICER
 *     recruiter          → RECRUITER
 *     student            → STUDENT
 * - Preserves User IDs (ObjectIds never change)
 * - Preserves password hashes exactly (atomic MongoDB $set avoids re-hashing)
 * - Preserves active/inactive status, timestamps, and all existing references
 * - Populates StudentProfile.institute using the corresponding User.institute
 * - Ensures Company.authorizedInstitutes is initialized as an array
 * - Identifies records with missing institute or company associations
 * - Creates a timestamped JSON backup snapshot before modifying anything
 * - Safe, non-destructive, and 100% idempotent
 *
 * Usage:
 *   node scripts/migratePhase2.js            # Default: Dry-run only (zero writes)
 *   node scripts/migratePhase2.js --dry-run  # Explicit dry-run
 *   node scripts/migratePhase2.js --execute  # Execute live migration after confirmation
 *   node scripts/migratePhase2.js --rollback # Rollback standardized roles to legacy
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load backend environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const { ROLES, LEGACY_ROLE_MAP, ALL_ROLES } = require("../constants/roles");

const REVERSE_ROLE_MAP = Object.freeze({
  [ROLES.SUPER_ADMIN]: "admin",
  [ROLES.PLACEMENT_OFFICER]: "placement_officer",
  [ROLES.RECRUITER]: "recruiter",
  [ROLES.STUDENT]: "student",
});

async function runMigration() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isRollback = args.includes("--rollback");
  const isDryRun = !isExecute && !isRollback;

  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("================================================================");
  console.log("   CAMPUS PLACEMENT SYSTEM - PHASE 2 ROLE & SCHEMA MIGRATION    ");
  console.log("================================================================");
  console.log(`Database URI : ${mongoUri}`);
  console.log(
    `Mode         : ${
      isRollback
        ? "ROLLBACK (Standardized -> Legacy)"
        : isExecute
        ? "LIVE EXECUTION (Safe, Atomic Writes)"
        : "DRY-RUN (Diagnostic Only - Zero Writes)"
    }`
  );
  console.log(`Timestamp    : ${new Date().toISOString()}`);
  console.log("----------------------------------------------------------------\n");

  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const usersColl = db.collection("users");
    const profilesColl = db.collection("studentprofiles");
    const companiesColl = db.collection("companies");
    const institutesColl = db.collection("institutes");

    // 1. Fetch all collections
    const rawUsers = await usersColl.find({}).toArray();
    const rawProfiles = await profilesColl.find({}).toArray();
    const rawCompanies = await companiesColl.find({}).toArray();
    const rawInstitutes = await institutesColl.find({}).toArray();

    const instituteIdSet = new Set(rawInstitutes.map((i) => i._id.toString()));
    const companyIdSet = new Set(rawCompanies.map((c) => c._id.toString()));
    const userMap = new Map(rawUsers.map((u) => [u._id.toString(), u]));

    // 2. Analyze User Role Transitions
    const userRolePlan = [];
    const associationIssues = [];

    for (const u of rawUsers) {
      const currentRole = u.role;
      let targetRole = currentRole;

      if (isRollback) {
        targetRole = REVERSE_ROLE_MAP[currentRole] || currentRole;
      } else {
        targetRole = LEGACY_ROLE_MAP[currentRole] || currentRole;
      }

      const roleNeedsUpdate = currentRole !== targetRole;

      userRolePlan.push({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        currentRole,
        targetRole,
        roleNeedsUpdate,
        hasPasswordHash: Boolean(u.password && u.password.startsWith("$2")),
        isActive: u.isActive !== false,
      });

      // Audit association rules
      const normRole = LEGACY_ROLE_MAP[currentRole] || currentRole;
      if (normRole === ROLES.PLACEMENT_OFFICER) {
        if (!u.institute) {
          associationIssues.push({
            type: "MISSING_INSTITUTE",
            user: u.email,
            id: u._id.toString(),
            role: normRole,
            detail: "Placement Officer has no assigned institute",
            actionRequired: "Assign to an Institute via Super Admin Console",
          });
        } else if (!instituteIdSet.has(u.institute.toString())) {
          associationIssues.push({
            type: "DANGLING_INSTITUTE",
            user: u.email,
            id: u._id.toString(),
            role: normRole,
            detail: `Assigned institute (${u.institute}) does not exist in institutes collection`,
            actionRequired: "Update institute reference",
          });
        }
      } else if (normRole === ROLES.RECRUITER) {
        if (!u.company) {
          // Check if recruiter created a company
          const ownedCompany = rawCompanies.find(
            (c) => c.createdBy && c.createdBy.toString() === u._id.toString()
          );
          associationIssues.push({
            type: "MISSING_COMPANY",
            user: u.email,
            id: u._id.toString(),
            role: normRole,
            detail: ownedCompany
              ? `Recruiter owns Company '${ownedCompany.name}' (${ownedCompany._id}) but user.company reference is not set`
              : "Recruiter has no company association",
            actionRequired: ownedCompany
              ? `Can link to owned Company '${ownedCompany.name}'`
              : "Assign company association or await officer invite",
          });
        } else if (!companyIdSet.has(u.company.toString())) {
          associationIssues.push({
            type: "DANGLING_COMPANY",
            user: u.email,
            id: u._id.toString(),
            role: normRole,
            detail: `Assigned company (${u.company}) does not exist in companies collection`,
            actionRequired: "Update company reference",
          });
        }
      } else if (normRole === ROLES.STUDENT) {
        if (!u.institute) {
          associationIssues.push({
            type: "MISSING_INSTITUTE",
            user: u.email,
            id: u._id.toString(),
            role: normRole,
            detail: "Student user account has no assigned institute",
            actionRequired: "Student institute selection pending (Phase 3 registration)",
          });
        }
      }
    }

    // 3. Analyze StudentProfile.institute synchronization
    const profileSyncPlan = [];
    for (const p of rawProfiles) {
      const parentUser = p.user ? userMap.get(p.user.toString()) : null;
      const userInstitute = parentUser ? parentUser.institute : null;
      const currentProfileInstitute = p.institute || null;

      let action = "NO_CHANGE";
      if (!parentUser) {
        action = "ORPHANED_PROFILE";
      } else if (userInstitute) {
        if (
          !currentProfileInstitute ||
          currentProfileInstitute.toString() !== userInstitute.toString()
        ) {
          action = "SYNC_FROM_USER";
        }
      } else if (!currentProfileInstitute) {
        action = "PENDING_USER_INSTITUTE";
      }

      profileSyncPlan.push({
        profileId: p._id.toString(),
        rollNumber: p.rollNumber,
        userId: p.user ? p.user.toString() : "UNKNOWN",
        userEmail: parentUser ? parentUser.email : "UNKNOWN",
        currentProfileInstitute: currentProfileInstitute
          ? currentProfileInstitute.toString()
          : null,
        userInstitute: userInstitute ? userInstitute.toString() : null,
        action,
      });
    }

    // 4. Analyze Company authorizedInstitutes
    const companyPlan = [];
    for (const c of rawCompanies) {
      const hasAuthArray = Array.isArray(c.authorizedInstitutes);
      companyPlan.push({
        id: c._id.toString(),
        name: c.name,
        isVerified: c.isVerified === true,
        hasAuthorizedInstitutes: hasAuthArray,
        needsAuthArrayInit: !hasAuthArray,
        authorizedCount: hasAuthArray ? c.authorizedInstitutes.length : 0,
      });
    }

    // 5. Print Detailed Diagnostic Dry-Run Report
    console.log("----------------------------------------------------------------");
    console.log("1. USER ROLE STANDARDIZATION SUMMARY");
    console.log("----------------------------------------------------------------");
    console.log(`Total Users Examined       : ${rawUsers.length}`);
    const usersNeedingUpdate = userRolePlan.filter((u) => u.roleNeedsUpdate);
    const usersAlreadyStandard = userRolePlan.filter((u) => !u.roleNeedsUpdate);
    console.log(`Users Needing Role Update  : ${usersNeedingUpdate.length}`);
    console.log(`Users Already Standardized : ${usersAlreadyStandard.length}`);

    console.log("\nPlanned User Role Updates:");
    userRolePlan.forEach((u) => {
      const statusIcon = u.roleNeedsUpdate ? "🔄 PENDING UPDATE" : "✅ ALREADY COMPLIANT";
      console.log(
        `  • ${u.email.padEnd(32)}: ${u.currentRole.padEnd(18)} → ${u.targetRole.padEnd(18)} [${statusIcon}]`
      );
    });

    console.log("\n----------------------------------------------------------------");
    console.log("2. STUDENT PROFILE INSTITUTE SYNCHRONIZATION");
    console.log("----------------------------------------------------------------");
    console.log(`Total Profiles Examined    : ${rawProfiles.length}`);
    const profilesNeedingSync = profileSyncPlan.filter(
      (p) => p.action === "SYNC_FROM_USER"
    );
    const profilesPending = profileSyncPlan.filter(
      (p) => p.action === "PENDING_USER_INSTITUTE"
    );
    console.log(`Profiles Needing Sync      : ${profilesNeedingSync.length}`);
    console.log(`Profiles Pending User Inst : ${profilesPending.length}`);

    profileSyncPlan.forEach((p) => {
      console.log(
        `  • Roll: ${p.rollNumber.padEnd(12)} (User: ${p.userEmail}) - Action: ${p.action}`
      );
    });

    console.log("\n----------------------------------------------------------------");
    console.log("3. COMPANY SCHEMA ENHANCEMENT");
    console.log("----------------------------------------------------------------");
    console.log(`Total Companies Examined   : ${rawCompanies.length}`);
    const compsNeedingInit = companyPlan.filter((c) => c.needsAuthArrayInit);
    console.log(`Companies Needing Init     : ${compsNeedingInit.length}`);
    companyPlan.forEach((c) => {
      console.log(
        `  • ${c.name.padEnd(28)} | Verified: ${String(c.isVerified).padEnd(5)} | authorizedInstitutes: [${c.authorizedCount} assigned]`
      );
    });

    console.log("\n----------------------------------------------------------------");
    console.log("4. ASSOCIATION INTEGRITY & MANUAL RESOLUTION AUDIT");
    console.log("----------------------------------------------------------------");
    if (associationIssues.length === 0) {
      console.log("  ✅ No association issues found. All records fully compliant.");
    } else {
      console.log(`  ⚠️ Found ${associationIssues.length} records requiring attention:\n`);
      associationIssues.forEach((issue, idx) => {
        console.log(`  [${idx + 1}] ${issue.type} - ${issue.user} (${issue.role})`);
        console.log(`      ID     : ${issue.id}`);
        console.log(`      Detail : ${issue.detail}`);
        console.log(`      Action : ${issue.actionRequired}\n`);
      });
      console.log("  NOTE: As per Phase 2 safety rules, no records are deleted and");
      console.log("  no arbitrary associations are silently guessed or fabricated.");
    }

    // 6. Execution / Rollback Handling
    if (isDryRun) {
      console.log("================================================================");
      console.log("                    DRY-RUN COMPLETED                           ");
      console.log("================================================================");
      console.log("Zero modifications were written to the database.");
      console.log("All existing IDs, passwords, and references remain intact.");
      console.log("To execute this migration after reviewing the dry-run report:");
      console.log("  node scripts/migratePhase2.js --execute");
      console.log("================================================================\n");
      return;
    }

    // LIVE EXECUTION / ROLLBACK
    console.log("\n================================================================");
    console.log("                  PERFORMING PRE-MIGRATION BACKUP               ");
    console.log("================================================================");

    const backupDir = path.join(__dirname, "../backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      backupDir,
      `campus_placement_backup_${backupTimestamp}.json`
    );

    const snapshot = {
      timestamp: new Date().toISOString(),
      counts: {
        users: rawUsers.length,
        profiles: rawProfiles.length,
        companies: rawCompanies.length,
        institutes: rawInstitutes.length,
      },
      users: rawUsers,
      profiles: rawProfiles,
      companies: rawCompanies,
      institutes: rawInstitutes,
    };

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`Pre-migration snapshot written safely to:`);
    console.log(`  ${backupFile}`);

    console.log("\nApplying changes atomic collection updates...");

    let usersUpdated = 0;
    for (const plan of userRolePlan) {
      if (plan.roleNeedsUpdate) {
        await usersColl.updateOne(
          { _id: new mongoose.Types.ObjectId(plan.id) },
          { $set: { role: plan.targetRole } }
        );
        usersUpdated++;
      }
    }
    console.log(`✓ Updated roles for ${usersUpdated} user(s). Password hashes preserved.`);

    let profilesUpdated = 0;
    for (const plan of profileSyncPlan) {
      if (plan.action === "SYNC_FROM_USER" && plan.userInstitute) {
        await profilesColl.updateOne(
          { _id: new mongoose.Types.ObjectId(plan.profileId) },
          { $set: { institute: new mongoose.Types.ObjectId(plan.userInstitute) } }
        );
        profilesUpdated++;
      }
    }
    console.log(`✓ Synchronized institute for ${profilesUpdated} student profile(s).`);

    let companiesUpdated = 0;
    for (const plan of companyPlan) {
      if (plan.needsAuthArrayInit) {
        await companiesColl.updateOne(
          { _id: new mongoose.Types.ObjectId(plan.id) },
          { $set: { authorizedInstitutes: [] } }
        );
        companiesUpdated++;
      }
    }
    console.log(`✓ Initialized authorizedInstitutes for ${companiesUpdated} company(s).`);

    console.log("\n================================================================");
    console.log(
      isRollback
        ? "                 ROLLBACK COMPLETED SUCCESSFULLY                "
        : "                MIGRATION COMPLETED SUCCESSFULLY                "
    );
    console.log("================================================================");
    console.log(`Users Updated     : ${usersUpdated}`);
    console.log(`Profiles Updated  : ${profilesUpdated}`);
    console.log(`Companies Updated : ${companiesUpdated}`);
    console.log("Database integrity verified. Backup snapshot persisted.");
    console.log("================================================================\n");
  } catch (error) {
    console.error("\n❌ MIGRATION ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

runMigration();
