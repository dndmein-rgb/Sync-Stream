import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  CLIENT_ORIGINS: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((o) => o.trim())),
  SOCKET_PATH: z.string().default("/socket.io"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "syncstream-api",
} as const;