import { query, getClient } from "../../db";
import {
  AdminBusinessSummary,
  PlatformStats,
  PaginatedResult,
  AdminActivityLogItem,
} from "./types";
import {
  AdminListBusinessesQueryInput,
  AdminListLogsQueryInput,
} from "./schemas";
import { SafeSubscription } from "../subscriptions/types";

export class BusinessNotFoundError extends Error {
  constructor(message = "Business not found") {
    super(message);
    this.name = "BusinessNotFoundError";
  }
}

export class InvalidBusinessStatusError extends Error {
  constructor(message = "Invalid business status transition") {
    super(message);
    this.name = "InvalidBusinessStatusError";
  }
}

/**
 * Returns platform-level summary statistics without exposing customer PII.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  // 1. Business counts
  const bizRes = await query<{
    total: string;
    active: string;
    suspended: string;
  }>(
    `SELECT 
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'active')::text AS active,
       COUNT(*) FILTER (WHERE status = 'suspended')::text AS suspended
     FROM platform.businesses;`
  );

  // 2. Subscription counts by status
  const subRes = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
     FROM platform.subscriptions
     GROUP BY status;`
  );

  const subscriptionsByStatus = {
    active: 0,
    past_due: 0,
    cancelled: 0,
    suspended: 0,
  };

  for (const row of subRes.rows) {
    if (row.status in subscriptionsByStatus) {
      subscriptionsByStatus[row.status as keyof typeof subscriptionsByStatus] = parseInt(row.count, 10);
    }
  }

  // 3. Booking counts
  const bookRes = await query<{
    total: string;
    confirmed: string;
    cancelled: string;
  }>(
    `SELECT 
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'confirmed')::text AS confirmed,
       COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled
     FROM booking.bookings;`
  );

  // 4. User counts by role
  const userRes = await query<{ role: string; count: string }>(
    `SELECT role, COUNT(*)::text AS count
     FROM platform.users
     GROUP BY role;`
  );

  const usersByRole = {
    platform_admin: 0,
    business_owner: 0,
    customer: 0,
  };

  let totalUsers = 0;
  for (const row of userRes.rows) {
    const c = parseInt(row.count, 10);
    totalUsers += c;
    if (row.role in usersByRole) {
      usersByRole[row.role as keyof typeof usersByRole] = c;
    }
  }

  const bRow = bizRes.rows[0];
  const bkRow = bookRes.rows[0];

  return {
    totalBusinesses: parseInt(bRow?.total || "0", 10),
    activeBusinesses: parseInt(bRow?.active || "0", 10),
    suspendedBusinesses: parseInt(bRow?.suspended || "0", 10),
    subscriptionsByStatus,
    totalBookings: parseInt(bkRow?.total || "0", 10),
    confirmedBookings: parseInt(bkRow?.confirmed || "0", 10),
    cancelledBookings: parseInt(bkRow?.cancelled || "0", 10),
    totalUsers,
    usersByRole,
  };
}

/**
 * Lists businesses with pagination, optional status filtering, and search.
 */
export async function listBusinesses(
  params: AdminListBusinessesQueryInput
): Promise<PaginatedResult<AdminBusinessSummary>> {
  const { page, limit, status, search } = params;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (status) {
    whereClauses.push(`b.status = $${paramIdx++}`);
    queryParams.push(status);
  }

  if (search) {
    whereClauses.push(`(b.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
    queryParams.push(`%${search}%`);
    paramIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Count total matching records
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM platform.businesses b
     JOIN platform.users u ON b.owner_id = u.id
     ${whereSql};`,
    queryParams
  );

  const total = parseInt(countRes.rows[0]?.count || "0", 10);
  const totalPages = Math.ceil(total / limit) || 1;

  // Retrieve paginated records with owner info, subscription, services count, bookings count
  const listQueryParams = [...queryParams, limit, offset];
  const listRes = await query<{
    id: string;
    name: string;
    timezone: string;
    status: "active" | "suspended";
    owner_id: string;
    owner_name: string;
    owner_email: string;
    sub_id: string | null;
    sub_plan: string | null;
    sub_status: string | null;
    sub_started_at: Date | null;
    sub_current_period_end: Date | null;
    sub_created_at: Date | null;
    sub_updated_at: Date | null;
    services_count: string;
    bookings_count: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT 
       b.id, b.name, b.timezone, b.status, b.created_at, b.updated_at,
       u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
       s.id AS sub_id, s.plan_name AS sub_plan, s.status AS sub_status,
       s.started_at AS sub_started_at, s.current_period_end AS sub_current_period_end,
       s.created_at AS sub_created_at, s.updated_at AS sub_updated_at,
       (SELECT COUNT(*)::text FROM booking.services svc WHERE svc.business_id = b.id) AS services_count,
       (SELECT COUNT(*)::text FROM booking.bookings bkg WHERE bkg.business_id = b.id) AS bookings_count
     FROM platform.businesses b
     JOIN platform.users u ON b.owner_id = u.id
     LEFT JOIN platform.subscriptions s ON b.id = s.business_id
     ${whereSql}
     ORDER BY b.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
    listQueryParams
  );

  const data: AdminBusinessSummary[] = listRes.rows.map((row) => {
    let subscription: SafeSubscription | null = null;
    if (row.sub_id) {
      subscription = {
        id: row.sub_id,
        businessId: row.id,
        planName: row.sub_plan || "starter",
        status: (row.sub_status as any) || "active",
        startedAt: row.sub_started_at instanceof Date ? row.sub_started_at.toISOString() : String(row.sub_started_at),
        currentPeriodEnd: row.sub_current_period_end
          ? row.sub_current_period_end instanceof Date
            ? row.sub_current_period_end.toISOString()
            : String(row.sub_current_period_end)
          : null,
        createdAt: row.sub_created_at instanceof Date ? row.sub_created_at.toISOString() : String(row.sub_created_at),
        updatedAt: row.sub_updated_at instanceof Date ? row.sub_updated_at.toISOString() : String(row.sub_updated_at),
      };
    }

    return {
      id: row.id,
      name: row.name,
      timezone: row.timezone,
      status: row.status,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      subscription,
      servicesCount: parseInt(row.services_count || "0", 10),
      bookingsCount: parseInt(row.bookings_count || "0", 10),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves full single business details for platform administrators.
 */
export async function getBusinessById(businessId: string): Promise<AdminBusinessSummary> {
  const result = await query<{
    id: string;
    name: string;
    timezone: string;
    status: "active" | "suspended";
    owner_id: string;
    owner_name: string;
    owner_email: string;
    sub_id: string | null;
    sub_plan: string | null;
    sub_status: string | null;
    sub_started_at: Date | null;
    sub_current_period_end: Date | null;
    sub_created_at: Date | null;
    sub_updated_at: Date | null;
    services_count: string;
    bookings_count: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT 
       b.id, b.name, b.timezone, b.status, b.created_at, b.updated_at,
       u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
       s.id AS sub_id, s.plan_name AS sub_plan, s.status AS sub_status,
       s.started_at AS sub_started_at, s.current_period_end AS sub_current_period_end,
       s.created_at AS sub_created_at, s.updated_at AS sub_updated_at,
       (SELECT COUNT(*)::text FROM booking.services svc WHERE svc.business_id = b.id) AS services_count,
       (SELECT COUNT(*)::text FROM booking.bookings bkg WHERE bkg.business_id = b.id) AS bookings_count
     FROM platform.businesses b
     JOIN platform.users u ON b.owner_id = u.id
     LEFT JOIN platform.subscriptions s ON b.id = s.business_id
     WHERE b.id = $1;`,
    [businessId]
  );

  if (result.rows.length === 0) {
    throw new BusinessNotFoundError();
  }

  const row = result.rows[0];
  let subscription: SafeSubscription | null = null;
  if (row.sub_id) {
    subscription = {
      id: row.sub_id,
      businessId: row.id,
      planName: row.sub_plan || "starter",
      status: (row.sub_status as any) || "active",
      startedAt: row.sub_started_at instanceof Date ? row.sub_started_at.toISOString() : String(row.sub_started_at),
      currentPeriodEnd: row.sub_current_period_end
        ? row.sub_current_period_end instanceof Date
          ? row.sub_current_period_end.toISOString()
          : String(row.sub_current_period_end)
        : null,
      createdAt: row.sub_created_at instanceof Date ? row.sub_created_at.toISOString() : String(row.sub_created_at),
      updatedAt: row.sub_updated_at instanceof Date ? row.sub_updated_at.toISOString() : String(row.sub_updated_at),
    };
  }

  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    status: row.status,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    subscription,
    servicesCount: parseInt(row.services_count || "0", 10),
    bookingsCount: parseInt(row.bookings_count || "0", 10),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Suspends a business and its subscription transactionally.
 */
export async function suspendBusiness(
  businessId: string,
  adminUserId: string
): Promise<AdminBusinessSummary> {
  const client = await getClient();

  try {
    await client.query("BEGIN;");

    const bizCheck = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM platform.businesses WHERE id = $1 FOR UPDATE;",
      [businessId]
    );

    if (bizCheck.rows.length === 0) {
      throw new BusinessNotFoundError();
    }

    if (bizCheck.rows[0].status === "suspended") {
      throw new InvalidBusinessStatusError("Business is already suspended");
    }

    // 1. Update business status
    await client.query(
      "UPDATE platform.businesses SET status = 'suspended', updated_at = NOW() WHERE id = $1;",
      [businessId]
    );

    // 2. Update subscription status
    await client.query(
      "UPDATE platform.subscriptions SET status = 'suspended', updated_at = NOW() WHERE business_id = $1;",
      [businessId]
    );

    // 3. Activity log
    await client.query(
      `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
       VALUES ($1, $2, 'BUSINESS_SUSPENDED');`,
      [businessId, adminUserId]
    );

    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  }

  return getBusinessById(businessId);
}

/**
 * Reactivates a suspended business and its subscription transactionally.
 */
export async function reactivateBusiness(
  businessId: string,
  adminUserId: string
): Promise<AdminBusinessSummary> {
  const client = await getClient();

  try {
    await client.query("BEGIN;");

    const bizCheck = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM platform.businesses WHERE id = $1 FOR UPDATE;",
      [businessId]
    );

    if (bizCheck.rows.length === 0) {
      throw new BusinessNotFoundError();
    }

    if (bizCheck.rows[0].status === "active") {
      throw new InvalidBusinessStatusError("Business is already active");
    }

    // 1. Update business status
    await client.query(
      "UPDATE platform.businesses SET status = 'active', updated_at = NOW() WHERE id = $1;",
      [businessId]
    );

    // 2. Update subscription status
    await client.query(
      "UPDATE platform.subscriptions SET status = 'active', updated_at = NOW() WHERE business_id = $1;",
      [businessId]
    );

    // 3. Activity log
    await client.query(
      `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
       VALUES ($1, $2, 'BUSINESS_ACTIVATED');`,
      [businessId, adminUserId]
    );

    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  }

  return getBusinessById(businessId);
}

/**
 * Lists platform activity logs with pagination and optional filters.
 */
export async function listActivityLogs(
  params: AdminListLogsQueryInput
): Promise<PaginatedResult<AdminActivityLogItem>> {
  const { page, limit, business_id, action } = params;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIdx = 1;

  if (business_id) {
    whereClauses.push(`al.business_id = $${paramIdx++}`);
    queryParams.push(business_id);
  }

  if (action) {
    whereClauses.push(`al.action = $${paramIdx++}`);
    queryParams.push(action);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Count total matching logs
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM platform.activity_logs al
     ${whereSql};`,
    queryParams
  );

  const total = parseInt(countRes.rows[0]?.count || "0", 10);
  const totalPages = Math.ceil(total / limit) || 1;

  const listQueryParams = [...queryParams, limit, offset];
  const listRes = await query<{
    id: string;
    business_id: string | null;
    business_name: string | null;
    actor_user_id: string | null;
    actor_email: string | null;
    action: string;
    created_at: Date;
  }>(
    `SELECT 
       al.id, al.business_id, b.name AS business_name,
       al.actor_user_id, u.email AS actor_email,
       al.action, al.created_at
     FROM platform.activity_logs al
     LEFT JOIN platform.businesses b ON al.business_id = b.id
     LEFT JOIN platform.users u ON al.actor_user_id = u.id
     ${whereSql}
     ORDER BY al.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
    listQueryParams
  );

  const data: AdminActivityLogItem[] = listRes.rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    action: row.action,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
