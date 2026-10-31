import pg from "pg";
import { config } from "../config/index.js";
import { redis } from "./redis.js";

export type ReadyCheck = {
  name: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

export type ReadyResult = {
  ready: boolean;
  checks: ReadyCheck[];
};

async function checkPostgres(): Promise<ReadyCheck> {
  const start = Date.now();
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2_000,
  });
  try {
    await pool.query("SELECT 1");
    return { name: "postgres", ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name: "postgres",
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkRedis(): Promise<ReadyCheck> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    return {
      name: "redis",
      ok: pong === "PONG",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: "redis",
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getReadyStatus(): Promise<ReadyResult> {
  const [pgCheck, redisCheck] = await Promise.all([
    checkPostgres(),
    checkRedis(),
  ]);
  return {
    ready: pgCheck.ok && redisCheck.ok,
    checks: [pgCheck, redisCheck],
  };
}