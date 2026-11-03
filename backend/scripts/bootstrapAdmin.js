/**
 * SECURE SUPER ADMIN BOOTSTRAP SCRIPT (Phase 4 - Stage 1)
 *
 * Requirements:
 * - Controlled one-time execution: succeeds ONLY when NO Super Admin exists.
 * - Rejects bootstrap if any SUPER_ADMIN account already exists in the database.
 * - Interactive terminal prompt or CLI argument input (no hardcoded credentials).
 * - Validates email and strong password requirements.
 * - Server-side assignment of role: SUPER_ADMIN.
 * - Records an immutable audit log event (action: "super_admin_bootstrap").
 * - Never prints or logs the plaintext password.
 *
 * Usage:
 *   Interactive:
 *     node scripts/bootstrapAdmin.js
 *   CLI Flags:
 *     node scripts/bootstrapAdmin.js --name "First Admin" --email "admin@campus.edu" --password "StrongPass@2026"
 */

const readline = require("readline");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { ROLES, normalizeRole } = require("../constants/roles");
const User = require("../models/User");
const AdminAuditLog = require("../models/AdminAuditLog");

function askQuestion(query, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden && process.stdin.isTTY) {
      process.stdout.write(query);
      const stdin = process.openStdin();
      let input = "";
      const onData = (char) => {
        char = char + "";
        switch (char) {
          case "\n":
          case "\r":
          case "\u0004":
            stdin.pause();
            break;
          default:
            process.stdout.write("*");
            input += char;
            break;
        }
      };
      process.stdin.on("data", onData);
      rl.on("close", () => {
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input.trim());
      });
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) parsed.name = args[++i];
    else if (args[i] === "--email" && args[i + 1]) parsed.email = args[++i];
    else if (args[i] === "--password" && args[i + 1]) parsed.password = args[++i];
  }
  return parsed;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password) && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number or special character" };
  }
  return { valid: true };
}

async function bootstrapSuperAdmin() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("================================================================");
  console.log("   CAMPUS PLACEMENT - SECURE SUPER ADMIN BOOTSTRAP SYSTEM       ");
  console.log("================================================================");
  console.log(`Target Database: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri);

    // 1. Enforce one-time bootstrap invariant: verify no existing Super Admin exists
    const existingAdmin = await User.findOne({
      role: { $in: [ROLES.SUPER_ADMIN, "admin", "SUPER_ADMIN"] },
    });

    if (existingAdmin) {
      console.error("\n❌ BOOTSTRAP REFUSED: A Super Admin account already exists in the system.");
      console.error(`   Existing Super Admin Account: ${existingAdmin.email}`);
      console.error("   For platform security, the bootstrap mechanism can only be executed");
      console.error("   when zero Super Admin accounts exist.\n");
      console.error("   To add additional administrators, please log in with the existing Super Admin");
      console.error("   at: http://localhost:5173/super-admin/login\n");
      process.exitCode = 1;
      return;
    }

    console.log("✓ Pre-condition verified: Zero Super Admin accounts found. Bootstrap unlocked.\n");

    // 2. Collect credentials securely
    const cli = parseCliArgs();
    let name = cli.name;
    let email = cli.email;
    let password = cli.password;

    if (!name) {
      name = await askQuestion("Enter Super Administrator Full Name: ");
    }
    if (!name || name.trim().length === 0) {
      name = "Platform Super Admin";
    }

    if (!email) {
      email = await askQuestion("Enter Super Administrator Email: ");
    }
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      console.error("\n❌ Invalid email format. Please provide a valid email address.");
      process.exitCode = 1;
      return;
    }

    if (!password) {
      password = await askQuestion("Enter Secure Password (min 8 chars, mixed): ");
    }

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.valid) {
      console.error(`\n❌ Password does not meet security requirements: ${strengthCheck.message}`);
      process.exitCode = 1;
      return;
    }

    // Double check email uniqueness
    const userWithEmail = await User.findOne({ email: normalizedEmail });
    if (userWithEmail) {
      console.error(`\n❌ An account with email '${normalizedEmail}' already exists.`);
      process.exitCode = 1;
      return;
    }

    // 3. Create Super Admin account with role: SUPER_ADMIN
    const adminUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password, // UserSchema pre-save hook securely hashes password with bcrypt (salt 10)
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      mustChangePassword: false,
    });

    // 4. Record immutable audit log
    await AdminAuditLog.create({
      action: "super_admin_bootstrap",
      performedBy: adminUser._id,
      targetUser: adminUser._id,
      details: {
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        timestamp: new Date().toISOString(),
        client: "secure_cli_bootstrap",
      },
    });

    console.log("\n================================================================");
    console.log("       INITIAL SUPER ADMIN ESTABLISHED SUCCESSFULLY!            ");
    console.log("================================================================");
    console.log(`Account ID : ${adminUser._id}`);
    console.log(`Admin Name : ${adminUser.name}`);
    console.log(`Email      : ${adminUser.email}`);
    console.log(`Role       : ${adminUser.role}`);
    console.log(`Status     : Active`);
    console.log(`Password   : [PROTECTED / BCRYPT HASHED]`);
    console.log("----------------------------------------------------------------");
    console.log("AUTHENTICATION PORTAL:");
    console.log("  URL: http://localhost:5173/super-admin/login");
    console.log("================================================================\n");
  } catch (error) {
    console.error("\n❌ Bootstrap execution failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  bootstrapSuperAdmin();
}

module.exports = {
  bootstrapSuperAdmin,
  validatePasswordStrength,
  validateEmail,
};
