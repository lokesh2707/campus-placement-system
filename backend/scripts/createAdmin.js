const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

// Load backend .env configuration
dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");

async function createSuperAdmin() {
  const args = process.argv.slice(2);
  const name = args[0] || "Super Administrator";
  const email = (args[1] || "admin@campus.edu").toLowerCase().trim();
  const password = args[2] || "AdminPassword@123";

  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("==================================================");
  console.log("      CAMPUS PLACEMENT - CREATE SUPER ADMIN       ");
  console.log("==================================================");
  console.log(`Target MongoDB : ${mongoUri}`);
  console.log(`Admin Name     : ${name}`);
  console.log(`Admin Email    : ${email}`);
  console.log(`Password       : ${"*".repeat(password.length)}`);
  console.log("--------------------------------------------------");

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.");

    let user = await User.findOne({ email });

    if (user) {
      console.log(`User found with email '${email}'. Updating role to 'SUPER_ADMIN'...`);
      user.name = name;
      user.role = "SUPER_ADMIN";
      user.isActive = true;
      if (args[2]) {
        user.password = password; // Hashed by UserSchema pre-save hook
      }
      await user.save();
      console.log(`SUCCESS: User '${email}' is now a Super Admin.`);
    } else {
      console.log(`Creating new Super Admin account for '${email}'...`);
      user = await User.create({
        name,
        email,
        password,
        role: "SUPER_ADMIN",
        isActive: true,
      });
      console.log(`SUCCESS: Super Admin account created with ID: ${user._id}`);
    }

    console.log("--------------------------------------------------");
    console.log("LOGIN DETAILS:");
    console.log(`  Login URL: http://localhost:5173/admin/security-gateway`);
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log(`  Dashboard: http://localhost:5173/admin/dashboard`);
    console.log("==================================================");
  } catch (error) {
    console.error("ERROR creating Super Admin:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

createSuperAdmin();
