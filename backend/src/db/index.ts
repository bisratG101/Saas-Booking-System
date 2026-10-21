import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "../config/env";

/**
 * PostgreSQL Connection Pool Module
 *
 * Implements a singleton pg.Pool configured for Neon PostgreSQL.
 * SSL is enforced for all cloud connections and production environments.
 */

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) {
    return pool;
  }

  if (!env.DATABASE_URL) {
    return null;
  }

  const isProduction = env.NODE_ENV === "production";
  const isNeon =
    env.DATABASE_URL.includes("neon.tech") ||
    env.DATABASE_URL.includes("sslmode=require");

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: isNeon || isProduction ? { rejectUnauthorized: true } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  pool.on("error", (err) => {
    console.error("❌ Unexpected error on idle PostgreSQL client:", err.message);
  });

  return pool;
}

/**
 * Execute a parameterized SQL query using the connection pool.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const currentPool = getPool();
  if (!currentPool) {
    throw new Error(
      "Database connection pool is not initialized. Ensure DATABASE_URL is set."
    );
  }
  return currentPool.query<T>(text, params);
}

/**
 * Acquire a dedicated client from the pool (e.g. for transactions).
 * The caller MUST call client.release() when finished.
 */
export async function getClient(): Promise<PoolClient> {
  const currentPool = getPool();
  if (!currentPool) {
    throw new Error(
      "Database connection pool is not initialized. Ensure DATABASE_URL is set."
    );
  }
  return currentPool.connect();
}

/**
 * Gracefully close the connection pool during application shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export interface DatabaseHealthResult {
  isConfigured: boolean;
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Check database connectivity by running a lightweight query (SELECT 1).
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  if (!env.DATABASE_URL) {
    return {
      isConfigured: false,
      isHealthy: false,
      error: "DATABASE_URL is not configured",
    };
  }

  const currentPool = getPool();
  if (!currentPool) {
    return {
      isConfigured: true,
      isHealthy: false,
      error: "Database pool failed to initialize",
    };
  }

  const start = Date.now();
  try {
    await currentPool.query("SELECT 1;");
    const latencyMs = Date.now() - start;
    return {
      isConfigured: true,
      isHealthy: true,
      latencyMs,
    };
  } catch (err) {
    return {
      isConfigured: true,
      isHealthy: false,
      error: "Database connection failed",
    };
  }
}
