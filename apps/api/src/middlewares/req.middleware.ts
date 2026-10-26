import type { RequestHandler } from "express";
import { logger } from "../config/logger.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(2)} ms`,
    );
  });

  next();
};