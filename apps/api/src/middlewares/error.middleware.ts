import type { Request, Response, NextFunction } from "express";
import { AppError } from "@syncstream/shared-utils";
import { logger } from "../config/logger.js";
import { metrics } from "../infrastructure/metrics.js";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode === 401) metrics.httpUnauthorized += 1;
    if (err.statusCode === 429) metrics.rateLimitHits += 1;
    logger.warn(
      { err, code: err.code, requestId: req.requestId, userId: req.user?.id },
      err.message,
    );
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  metrics.unhandledErrors += 1;
  logger.error(
    { err, requestId: req.requestId, userId: req.user?.id },
    "Unhandled error",
  );
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
  });
}