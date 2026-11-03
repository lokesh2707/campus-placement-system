/**
 * Complete Database Reset Script
 * Drops all collections in the local 'campus_placement' database.
 * Does NOT seed any accounts.
 */

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function resetDatabase() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("==================================================");
  console.log("   CAMPUS PLACEMENT - COMPLETE DATABASE RESET    ");
  console.log("==================================================");
  console.log(`Target URI: ${mongoUri}`);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  // Strict safety check
  if (dbName !== "campus_placement") {
    console.error(`ABORT: Refusing to reset database '${dbName}'. Target MUST be 'campus_placement'.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Safety check: verify host is local
  const host = mongoose.connection.host;
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(`ABORT: Target host is '${host}', expected local 127.0.0.1. Aborting!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collection(s) to drop in '${dbName}':`);

  const dropped = [];
  for (const collInfo of collections) {
    const name = collInfo.name;
    // Skip system collections if any
    if (name.startsWith("system.")) continue;

    await db.collection(name).drop();
    dropped.push(name);
    console.log(`  ✓ Dropped collection: ${name}`);
  }

  // Re-verify database state
  const remainingCollections = await db.listCollections().toArray();
  const nonSystemRemaining = remainingCollections.filter(
    (c) => !c.name.startsWith("system.")
  );

  console.log("--------------------------------------------------");
  console.log(`Reset completed!`);
  console.log(`Collections dropped : ${dropped.length} (${dropped.join(", ")})`);
  console.log(`Remaining non-system: ${nonSystemRemaining.length}`);
  console.log(`Default accounts    : 0 (No seed accounts created)`);
  console.log("==================================================");

  await mongoose.disconnect();
}

resetDatabase().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
