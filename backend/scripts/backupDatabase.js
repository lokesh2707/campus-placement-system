/**
 * Complete Database Backup Script
 * Dumps all collections, documents, and index specifications from campus_placement
 * into a timestamped local backup directory.
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

async function backupDatabase() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  console.log("==================================================");
  console.log("   CAMPUS PLACEMENT - COMPLETE DATABASE BACKUP   ");
  console.log("==================================================");
  console.log(`Source URI: ${mongoUri}`);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  if (dbName !== "campus_placement") {
    console.error(`ERROR: Target DB is '${dbName}', expected 'campus_placement'. Aborting!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(
    __dirname,
    `../backups/campus_placement_pre_reset_${timestamp}`
  );

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collection(s) in '${dbName}':`);

  const summary = {
    database: dbName,
    timestamp: new Date().toISOString(),
    mongoUri,
    collections: {},
  };

  for (const collInfo of collections) {
    const collName = collInfo.name;
    const coll = db.collection(collName);

    const docs = await coll.find({}).toArray();
    const indexes = await coll.indexes();

    const collFile = path.join(backupDir, `${collName}.json`);
    const collData = {
      name: collName,
      count: docs.length,
      indexes,
      documents: docs,
    };

    fs.writeFileSync(collFile, JSON.stringify(collData, null, 2), "utf8");
    console.log(`  ✓ ${collName.padEnd(25)}: ${docs.length} document(s), ${indexes.length} index(es) -> ${path.basename(collFile)}`);

    summary.collections[collName] = {
      count: docs.length,
      indexesCount: indexes.length,
      file: `${collName}.json`,
    };
  }

  const summaryFile = path.join(backupDir, "backup_manifest.json");
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), "utf8");

  console.log("--------------------------------------------------");
  console.log(`Backup completed successfully!`);
  console.log(`Directory: ${backupDir}`);
  console.log("==================================================");

  await mongoose.disconnect();
  return backupDir;
}

backupDatabase().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
