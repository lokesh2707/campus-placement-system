const mongoose = require("mongoose");

const getHealth = (req, res) => {
  // mongoose.connection.readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  res.status(200).json({
    success: true,
    message: "Campus Placement Intelligence API is running",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getHealth };
