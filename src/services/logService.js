// src/services/logService.js
const { getDb, connectMongo } = require("../config/mongo");

async function logAuthEvent(eventType, details) {
  try {
    await connectMongo(); 
    const db = getDb();

    const logEntry = {
      eventType,
      details,
      timestamp: new Date(),
    };

    await db.collection("adminAuthLogs").insertOne(logEntry);
  } catch (error) {
    console.error("Failed to log auth event:", error);
  }
}

module.exports = { logAuthEvent };
