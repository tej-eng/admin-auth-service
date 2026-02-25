import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB;

let client;
let db;

export async function connectMongo() {
  try {
    if (db) return db;

    client = new MongoClient(uri);

    await client.connect();
    console.log("MongoDB connected successfully");

    db = client.db(dbName);

    const collections = await db
      .listCollections({ name: "userAuthLogs" })
      .toArray();

    if (collections.length === 0) {
      await db.createCollection("userAuthLogs", {
        capped: true,
        size: 1024 * 1024 * 5, // 5 MB
        max: 10000,
      });
    }

    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    throw error;
  }
}

export function getDb() {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongo() first.");
  }
  return db;
}