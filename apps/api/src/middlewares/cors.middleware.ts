import cors from "cors";
import { config } from "../config/index.js";

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // no Origin = curl / server-to-server
    if (!origin || config.CLIENT_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
  optionsSuccessStatus: 204,
});