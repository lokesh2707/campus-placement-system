const mongoose = require("mongoose");

/**
 * Connect to MongoDB using the URI specified in the environment variables.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_placement";

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Diagnostics event listeners
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB connection disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB runtime error: ${err.message}`);
});

module.exports = connectDB;
