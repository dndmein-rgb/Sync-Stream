import {Redis} from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { metrics } from "./metrics.js";

/**
 * Primary Redis client used by the application
 * (presence, playback state, etc.).
 */
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required by @socket.io/redis-adapter
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("ready", () => logger.info("Redis ready"));
redis.on("error", (err) => {
  metrics.redisErrors += 1;
  logger.error({ err }, "Redis error");
});redis.on("close", () => logger.warn("Redis connection closed"));

/**
 * Graceful shutdown helper.
 */
export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info("Redis disconnected");
  } catch (err) {
    logger.error({ err }, "Error closing Redis");
    // force close if quit fails
    redis.disconnect();
  }
}