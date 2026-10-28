import "dotenv/config";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is missing from .env");
}

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});