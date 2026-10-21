import { env } from "../config/env";
import { query, closePool } from "../db";
import { hashPassword } from "../modules/auth/password";
import { UserRecord } from "../modules/auth/types";

/**
 * Controlled Platform Admin Seed Script
 *
 * Requirements:
 * - Obtains values securely from environment variables (ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD).
 * - Fails safely if required admin credentials are not provided.
 * - Never prints the password or password hash.
 * - Checks if an administrator account already exists.
 * - Never runs automatically on server boot.
 */
async function seedAdmin() {
  console.log("🔐 Checking platform admin seed prerequisites...");

  const adminName = env.ADMIN_NAME || "Platform Administrator";
  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment variables to seed the admin account.");
    console.error("   Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=super-secure-password npm run seed:admin");
    process.exit(1);
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  try {
    // 1. Check if an account with this email already exists
    const existing = await query<UserRecord>(
      "SELECT id, role FROM platform.users WHERE LOWER(email) = LOWER($1);",
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === "platform_admin") {
        console.log(`ℹ️ Platform admin account '${normalizedEmail}' already exists. No action taken.`);
        process.exit(0);
      } else {
        console.error(`❌ Cannot promote user '${normalizedEmail}' with role '${user.role}' via seed script.`);
        process.exit(1);
      }
    }

    // 2. Hash password and insert platform_admin account
    console.log(`⏳ Hashing credentials and creating platform admin: ${normalizedEmail}...`);
    const passwordHash = await hashPassword(adminPassword);

    await query(
      `INSERT INTO platform.users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'platform_admin');`,
      [adminName, normalizedEmail, passwordHash]
    );

    console.log(`✅ Platform admin created successfully: ${normalizedEmail}`);
    process.exit(0);
  } catch (err: any) {
    console.error("💥 Failed to seed platform admin:", err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

seedAdmin();
