// apps/api/src/middlewares/req.middleware.ts
import type { RequestHandler } from "express";
import { logger } from "../config/logger.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userId: req.user?.id,
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(2)} ms`,
    );
  });

  next();
};