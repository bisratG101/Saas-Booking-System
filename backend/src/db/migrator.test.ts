import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as dbModule from "./index";
import { runMigrations } from "./migrator";

describe("SQL Migrator Test Suite", () => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockRelease.mockReset();

    vi.spyOn(dbModule, "getClient").mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    } as any);
  });

  it("should fail gracefully if the migrations directory does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // advisory lock
    mockQuery.mockResolvedValueOnce({ rows: [] }); // create table
    mockQuery.mockResolvedValueOnce({ rows: [] }); // get existing migrations

    await expect(
      runMigrations("C:/non-existent-directory-12345")
    ).rejects.toThrow("Migrations directory not found");

    expect(mockRelease).toHaveBeenCalled();
  });

  it("should detect if an applied migration file was tampered with (checksum mismatch)", async () => {
    // Setup temporary test directory with a mock migration
    const tempDir = path.resolve(__dirname, "../../migrations_test_tamper");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const testFile = path.join(tempDir, "001_test.sql");
    fs.writeFileSync(testFile, "CREATE TABLE test_table (id INT);");

    mockQuery.mockResolvedValueOnce({ rows: [] }); // advisory lock
    mockQuery.mockResolvedValueOnce({ rows: [] }); // create table
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          name: "001_test.sql",
          checksum: "incorrect_stored_checksum_abcdef",
        },
      ],
    }); // get existing migrations

    await expect(runMigrations(tempDir)).rejects.toThrow(
      "Migrations must remain immutable"
    );

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should apply pending migrations transactionally and insert migration record", async () => {
    const tempDir = path.resolve(__dirname, "../../migrations_test_success");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const testFile = path.join(tempDir, "001_test.sql");
    fs.writeFileSync(testFile, "CREATE TABLE test_table (id INT);");

    mockQuery.mockResolvedValueOnce({ rows: [] }); // advisory lock
    mockQuery.mockResolvedValueOnce({ rows: [] }); // create table
    mockQuery.mockResolvedValueOnce({ rows: [] }); // existing migrations (empty)
    mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SQL execution
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT into schema_migrations
    mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] }); // unlock

    const result = await runMigrations(tempDir);

    expect(result.applied).toEqual(["001_test.sql"]);
    expect(result.skipped).toEqual([]);
    expect(result.total).toBe(1);

    // Verify BEGIN and COMMIT were invoked
    expect(mockQuery).toHaveBeenCalledWith("BEGIN;");
    expect(mockQuery).toHaveBeenCalledWith("COMMIT;");
    expect(mockRelease).toHaveBeenCalled();

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
