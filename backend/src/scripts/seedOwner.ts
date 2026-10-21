import { query, closePool, getClient } from "../db";
import { hashPassword } from "../modules/auth/password";
import { createBusiness } from "../modules/businesses/businessService";
import { UserRecord } from "../modules/auth/types";

/**
 * Convenience script to create or reset a Business Owner account for local testing.
 *
 * Usage:
 *   OWNER_NAME="Dr. Abel" OWNER_EMAIL="owner@example.com" OWNER_PASSWORD="Password123!" BIZ_NAME="Addis Dental" npx tsx src/scripts/seedOwner.ts
 */
async function seedOwner() {
  const name = process.env.OWNER_NAME || "Demo Business Owner";
  const email = (process.env.OWNER_EMAIL || "owner@example.com").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || "Password123!";
  const businessName = process.env.BIZ_NAME || "Addis Medical Center";
  const timezone = process.env.BIZ_TIMEZONE || "Africa/Addis_Ababa";

  console.log(`\n🏢 Setting up Business Owner account: ${email}...`);

  const client = await getClient();

  try {
    await client.query("BEGIN;");

    // 1. Check if user already exists
    const existing = await client.query<UserRecord>(
      "SELECT id, role FROM platform.users WHERE LOWER(email) = LOWER($1);",
      [email]
    );

    let ownerId: string;

    if (existing.rows.length > 0) {
      ownerId = existing.rows[0].id;
      const passwordHash = await hashPassword(password);

      // Update existing user to business_owner with new password
      await client.query(
        `UPDATE platform.users
         SET password_hash = $1, role = 'business_owner', updated_at = NOW()
         WHERE id = $2;`,
        [passwordHash, ownerId]
      );
      console.log(`ℹ️ Existing user '${email}' updated to role 'business_owner' with new password.`);
    } else {
      const passwordHash = await hashPassword(password);
      const userRes = await client.query<UserRecord>(
        `INSERT INTO platform.users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'business_owner')
         RETURNING id, name, email, role;`,
        [name, email, passwordHash]
      );
      ownerId = userRes.rows[0].id;
      console.log(`✅ Created new user '${email}' with role 'business_owner'.`);
    }

    // 2. Check if business already exists for this owner
    const existingBiz = await client.query(
      "SELECT id, name FROM platform.businesses WHERE owner_id = $1;",
      [ownerId]
    );

    let businessId: string;

    if (existingBiz.rows.length === 0) {
      const bizRes = await client.query(
        `INSERT INTO platform.businesses (owner_id, name, timezone, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, name;`,
        [ownerId, businessName, timezone]
      );
      businessId = bizRes.rows[0].id;

      // Create starter subscription
      await client.query(
        `INSERT INTO platform.subscriptions (business_id, plan_name, status, started_at)
         VALUES ($1, 'starter', 'active', NOW());`,
        [businessId]
      );

      // Initialize default Monday-Friday 09:00 - 17:00 business hours
      for (let day = 1; day <= 7; day++) {
        const isClosed = day === 6 || day === 7;
        await client.query(
          `INSERT INTO booking.business_hours (business_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1, $2, $3, $4, $5);`,
          [
            businessId,
            day,
            isClosed ? null : "09:00:00",
            isClosed ? null : "17:00:00",
            isClosed,
          ]
        );
      }

      console.log(`✅ Created business '${businessName}' with active starter subscription and weekly hours.`);
    } else {
      businessId = existingBiz.rows[0].id;
      console.log(`ℹ️ Owner already possesses business: '${existingBiz.rows[0].name}'.`);
    }

    await client.query("COMMIT;");

    console.log("\n🎉 Ready to log in!");
    console.log(`   URL:      http://localhost:5173/login`);
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}\n`);
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Failed to set up business owner:", err);
  } finally {
    client.release();
    await closePool();
  }
}

seedOwner();
