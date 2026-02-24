// src/config/redis.js

const Redis = require("ioredis");

const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  // password: "your_password", // if needed
});

redis.on("connect", () => {
  console.log("ioredis Connected");
});

redis.on("error", (err) => {
  console.error("ioredis Error:", err);
});

module.exports = redis;
