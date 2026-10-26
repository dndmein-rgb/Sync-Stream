import pg from "pg";
import { config } from "../config/index.js";

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

export async function getReadyStatus(): Promise<ReadyResult> {
  const pgCheck = await checkPostgres();
  return {
    ready: pgCheck.ok,
    checks: [pgCheck],
  };
}