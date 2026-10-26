import express from "express";

import { getReadyStatus } from "./infrastructure/ready.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { requestLogger } from "./middlewares/req.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(requestLogger);

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "syncstream-api",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_req, res) => {
    const result = await getReadyStatus();
    res.status(result.ready ? 200 : 503).json({
      status: result.ready ? "ready" : "not_ready",
      service: "syncstream-api",
      checks: result.checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorMiddleware);
  return app;
}