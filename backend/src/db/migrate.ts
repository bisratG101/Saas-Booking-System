import { runMigrations } from "./migrator";
import { closePool } from "./index";

async function main() {
  console.log("🐘 Starting database migration runner...");
  try {
    const result = await runMigrations();
    console.log(`\n🎉 Migrations completed successfully!`);
    console.log(`   Total discovered: ${result.total}`);
    console.log(`   Applied:          ${result.applied.length}`);
    console.log(`   Skipped:          ${result.skipped.length}`);
    process.exit(0);
  } catch (err) {
    console.error("\n💥 Migration execution failed:");
    console.error(err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
