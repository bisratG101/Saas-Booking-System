import { query, getClient } from "../../db";
import { CreateBusinessInput, UpdateBusinessInput } from "./schemas";
import { BusinessRecord, SafeBusiness } from "./types";

export class BusinessAlreadyExistsError extends Error {
  constructor(message = "User already owns a business. In V1, only one business per owner is permitted.") {
    super(message);
    this.name = "BusinessAlreadyExistsError";
  }
}

export class BusinessNotFoundError extends Error {
  constructor(message = "Business not found") {
    super(message);
    this.name = "BusinessNotFoundError";
  }
}

export class ForbiddenOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenOperationError";
  }
}

function mapToSafeBusiness(row: BusinessRecord): SafeBusiness {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Creates a new business for an authenticated user.
 * Transactionally creates the business record and transitions user role to 'business_owner'.
 */
export async function createBusiness(
  ownerId: string,
  input: CreateBusinessInput
): Promise<SafeBusiness> {
  const client = await getClient();

  try {
    await client.query("BEGIN;");

    // 1. Verify user role & check for platform_admin
    const userResult = await client.query<{ role: string }>(
      "SELECT role FROM platform.users WHERE id = $1 FOR UPDATE;",
      [ownerId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User record not found");
    }

    if (userResult.rows[0].role === "platform_admin") {
      throw new ForbiddenOperationError("Platform administrators cannot create business entities");
    }

    // 2. Check if user already owns a business
    const existing = await client.query(
      "SELECT id FROM platform.businesses WHERE owner_id = $1;",
      [ownerId]
    );

    if (existing.rows.length > 0) {
      throw new BusinessAlreadyExistsError();
    }

    // 3. Insert business
    const businessResult = await client.query<BusinessRecord>(
      `INSERT INTO platform.businesses (owner_id, name, timezone, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, owner_id, name, timezone, status, created_at, updated_at;`,
      [ownerId, input.name.trim(), input.timezone.trim()]
    );

    const business = businessResult.rows[0];

    // 4. Transition user role to 'business_owner'
    await client.query(
      `UPDATE platform.users
       SET role = 'business_owner', updated_at = NOW()
       WHERE id = $1;`,
      [ownerId]
    );

    // 5. Initialize default 'starter' subscription
    await client.query(
      `INSERT INTO platform.subscriptions (business_id, plan_name, status, started_at)
       VALUES ($1, 'starter', 'active', NOW());`,
      [business.id]
    );

    // 6. Activity logs
    await client.query(
      `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
       VALUES ($1, $2, 'BUSINESS_REGISTERED'), ($1, $2, 'SUBSCRIPTION_CREATED');`,
      [business.id, ownerId]
    );

    await client.query("COMMIT;");
    return mapToSafeBusiness(business);
  } catch (err: any) {
    await client.query("ROLLBACK;");
    if (err.code === "23505") {
      throw new BusinessAlreadyExistsError();
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves business details for an owner by user ID.
 */
export async function getBusinessByOwnerId(ownerId: string): Promise<SafeBusiness | null> {
  const result = await query<BusinessRecord>(
    `SELECT id, owner_id, name, timezone, status, created_at, updated_at
     FROM platform.businesses
     WHERE owner_id = $1;`,
    [ownerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapToSafeBusiness(result.rows[0]);
}

/**
 * Updates business details (name and/or timezone).
 */
export async function updateBusiness(
  businessId: string,
  input: UpdateBusinessInput
): Promise<SafeBusiness> {
  const result = await query<BusinessRecord>(
    `UPDATE platform.businesses
     SET
       name = COALESCE($1, name),
       timezone = COALESCE($2, timezone),
       updated_at = NOW()
     WHERE id = $3
     RETURNING id, owner_id, name, timezone, status, created_at, updated_at;`,
    [
      input.name ? input.name.trim() : null,
      input.timezone ? input.timezone.trim() : null,
      businessId,
    ]
  );

  if (result.rows.length === 0) {
    throw new BusinessNotFoundError();
  }

  return mapToSafeBusiness(result.rows[0]);
}

/**
 * Lists public businesses that are currently active.
 * Suspended businesses are strictly excluded.
 */
export async function listActiveBusinesses(): Promise<SafeBusiness[]> {
  const result = await query<BusinessRecord>(
    `SELECT id, owner_id, name, timezone, status, created_at, updated_at
     FROM platform.businesses
     WHERE status = 'active'
     ORDER BY name ASC;`
  );

  return result.rows.map(mapToSafeBusiness);
}

/**
 * Retrieves a single business by ID.
 */
export async function getBusinessById(businessId: string): Promise<SafeBusiness | null> {
  const result = await query<BusinessRecord>(
    `SELECT id, owner_id, name, timezone, status, created_at, updated_at
     FROM platform.businesses
     WHERE id = $1;`,
    [businessId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapToSafeBusiness(result.rows[0]);
}
