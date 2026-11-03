const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

// Load backend .env configuration
dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");

async function createPlacementOfficer() {
  const args = process.argv.slice(2);
  const name = args[0] || "Placement Officer";
  const email = (args[1] || "officer@campus.edu").toLowerCase().trim();
  const password = args[2] || "OfficerPassword@123";

  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("==================================================");
  console.log("   CAMPUS PLACEMENT - CREATE PLACEMENT OFFICER    ");
  console.log("==================================================");
  console.log(`Target MongoDB : ${mongoUri}`);
  console.log(`Officer Name   : ${name}`);
  console.log(`Officer Email  : ${email}`);
  console.log(`Password       : ${"*".repeat(password.length)}`);
  console.log("--------------------------------------------------");

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.");

    let user = await User.findOne({ email });

    if (user) {
      console.log(`User found with email '${email}'. Updating role to 'PLACEMENT_OFFICER'...`);
      user.name = name;
      user.role = "PLACEMENT_OFFICER";
      user.isActive = true;
      if (args[2]) {
        user.password = password; // Will be hashed by UserSchema pre-save hook
      }
      await user.save();
      console.log(`SUCCESS: User '${email}' is now a Placement Officer.`);
    } else {
      console.log(`Creating new Placement Officer account for '${email}'...`);
      user = await User.create({
        name,
        email,
        password,
        role: "PLACEMENT_OFFICER",
        isActive: true,
      });
      console.log(`SUCCESS: Placement Officer account created with ID: ${user._id}`);
    }

    console.log("--------------------------------------------------");
    console.log("LOGIN DETAILS:");
    console.log(`  Login URL: http://localhost:5173/placement-officer/login`);
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log("==================================================");
  } catch (error) {
    console.error("ERROR creating Placement Officer:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

createPlacementOfficer();
