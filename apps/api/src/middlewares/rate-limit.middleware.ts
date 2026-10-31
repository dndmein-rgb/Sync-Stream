// apps/api/src/middlewares/rate-limit.middleware.ts
import type { NextFunction, Request, Response } from "express";
import { AppError } from "@syncstream/shared-utils";
import { metrics } from "../infrastructure/metrics.js";

type Bucket = { timestamps: number[] };

export function createRateLimit(options: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  code?: string;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();
  const {
    windowMs,
    max,
    keyFn = (req) => req.ip ?? "unknown",
    code = "RATE_LIMITED",
    message = "Too many requests; slow down",
  } = options;

  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      b.timestamps = b.timestamps.filter((t) => now - t < windowMs);
      if (b.timestamps.length === 0) buckets.delete(k);
    }
  }, Math.max(windowMs, 30_000)).unref?.();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    const now = Date.now();
    const bucket = buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= max) {
      metrics.rateLimitHits += 1;
      buckets.set(key, bucket);
      next(new AppError(code, message, 429));
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);
    next();
  };
}

export const defaultApiRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 120,
});

export const authRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 20,
  message: "Too many auth attempts; try again later",
});