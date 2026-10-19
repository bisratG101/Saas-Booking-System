import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PoolClient } from "pg";
import { getClient } from "./index";

/**
 * SQL Migration Runner
 *
 * Guarantees:
 * 1. Safe concurrent execution via PostgreSQL advisory lock.
 * 2. Transactional execution of each migration file (atomic rollback on error).
 * 3. Migration tracking via platform.schema_migrations table.
 * 4. Checksum verification to prevent tampering with previously applied migrations.
 */

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  total: number;
}

export async function runMigrations(
  migrationsDir: string = path.resolve(__dirname, "../../migrations")
): Promise<MigrationResult> {
  const client: PoolClient = await getClient();

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // 1. Acquire PostgreSQL Advisory Lock (prevents concurrent migrations across instances)
    await client.query("SELECT pg_advisory_lock(hashtext('saas_booking_migrations_lock'));");

    // 2. Ensure platform schema and migration tracking table exist
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS platform;

      CREATE TABLE IF NOT EXISTS platform.schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Retrieve already applied migrations
    const { rows: existingRows } = await client.query<{
      name: string;
      checksum: string;
    }>("SELECT name, checksum FROM platform.schema_migrations ORDER BY id ASC;");

    const appliedMap = new Map<string, string>();
    for (const row of existingRows) {
      appliedMap.set(row.name, row.checksum);
    }

    // 4. Discover and sort migration files
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    // 5. Process each migration in strict order
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");
      const currentChecksum = crypto
        .createHash("sha256")
        .update(sqlContent)
        .digest("hex");

      if (appliedMap.has(file)) {
        const storedChecksum = appliedMap.get(file);
        if (storedChecksum !== currentChecksum) {
          throw new Error(
            `Migration '${file}' has been altered after being applied! ` +
            `Stored checksum: ${storedChecksum}, current: ${currentChecksum}. ` +
            `Migrations must remain immutable.`
          );
        }
        skipped.push(file);
        continue;
      }

      // Apply pending migration transactionally
      console.log(`⏳ Applying migration: ${file}...`);
      try {
        await client.query("BEGIN;");
        await client.query(sqlContent);
        await client.query(
          "INSERT INTO platform.schema_migrations (name, checksum) VALUES ($1, $2);",
          [file, currentChecksum]
        );
        await client.query("COMMIT;");
        applied.push(file);
        console.log(`✅ Applied migration: ${file}`);
      } catch (migrationErr) {
        await client.query("ROLLBACK;");
        console.error(`❌ Migration '${file}' failed and was rolled back.`);
        throw migrationErr;
      }
    }

    return {
      applied,
      skipped,
      total: files.length,
    };
  } finally {
    // Release advisory lock and return client to pool
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('saas_booking_migrations_lock'));");
    } catch (unlockErr) {
      console.error("⚠️ Failed to release advisory lock:", unlockErr);
    }
    client.release();
  }
}
