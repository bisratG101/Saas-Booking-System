import { query, getClient } from "../../db";
import { SubscriptionRecord, SafeSubscription } from "./types";
import { UpdateSubscriptionInput } from "./schemas";

export class SubscriptionNotFoundError extends Error {
  constructor(message = "Subscription not found") {
    super(message);
    this.name = "SubscriptionNotFoundError";
  }
}

export class InvalidSubscriptionStatusError extends Error {
  constructor(message = "Invalid subscription status transition") {
    super(message);
    this.name = "InvalidSubscriptionStatusError";
  }
}

export class UnauthorizedSubscriptionOperationError extends Error {
  constructor(message = "Unauthorized subscription modification") {
    super(message);
    this.name = "UnauthorizedSubscriptionOperationError";
  }
}

export function mapToSafeSubscription(row: SubscriptionRecord): SafeSubscription {
  return {
    id: row.id,
    businessId: row.business_id,
    planName: row.plan_name,
    status: row.status,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
    currentPeriodEnd: row.current_period_end
      ? row.current_period_end instanceof Date
        ? row.current_period_end.toISOString()
        : String(row.current_period_end)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/**
 * Retrieves the current subscription for a business.
 * If a legacy or test business exists without a subscription, initializes a default 'starter' active record.
 */
export async function getSubscriptionByBusinessId(
  businessId: string
): Promise<SafeSubscription> {
  const result = await query<SubscriptionRecord>(
    `SELECT id, business_id, plan_name, status, started_at, current_period_end, created_at, updated_at
     FROM platform.subscriptions
     WHERE business_id = $1;`,
    [businessId]
  );

  if (result.rows.length > 0) {
    return mapToSafeSubscription(result.rows[0]);
  }

  // Auto-initialize default subscription if missing for an active business
  const initResult = await query<SubscriptionRecord>(
    `INSERT INTO platform.subscriptions (business_id, plan_name, status, started_at)
     VALUES ($1, 'starter', 'active', NOW())
     ON CONFLICT (business_id) DO UPDATE SET updated_at = NOW()
     RETURNING id, business_id, plan_name, status, started_at, current_period_end, created_at, updated_at;`,
    [businessId]
  );

  return mapToSafeSubscription(initResult.rows[0]);
}

/**
 * Business owner cancels their subscription.
 * Transitions subscription status from 'active' or 'past_due' to 'cancelled'.
 */
export async function cancelOwnerSubscription(
  businessId: string,
  actorUserId: string
): Promise<SafeSubscription> {
  const currentSub = await getSubscriptionByBusinessId(businessId);

  if (currentSub.status === "cancelled") {
    throw new InvalidSubscriptionStatusError("Subscription is already cancelled");
  }

  const result = await query<SubscriptionRecord>(
    `UPDATE platform.subscriptions
     SET status = 'cancelled', updated_at = NOW()
     WHERE business_id = $1
     RETURNING id, business_id, plan_name, status, started_at, current_period_end, created_at, updated_at;`,
    [businessId]
  );

  await query(
    `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
     VALUES ($1, $2, 'SUBSCRIPTION_CANCELLED');`,
    [businessId, actorUserId]
  );

  return mapToSafeSubscription(result.rows[0]);
}

/**
 * Administrative subscription update (plan and/or status).
 */
export async function adminUpdateSubscription(
  businessId: string,
  input: UpdateSubscriptionInput,
  adminUserId: string
): Promise<SafeSubscription> {
  // Ensure subscription exists
  await getSubscriptionByBusinessId(businessId);

  const updates: string[] = ["updated_at = NOW()"];
  const values: any[] = [businessId];
  let paramIdx = 2;

  if (input.plan_name) {
    updates.push(`plan_name = $${paramIdx++}`);
    values.push(input.plan_name);
  }

  if (input.status) {
    updates.push(`status = $${paramIdx++}`);
    values.push(input.status);
  }

  const result = await query<SubscriptionRecord>(
    `UPDATE platform.subscriptions
     SET ${updates.join(", ")}
     WHERE business_id = $1
     RETURNING id, business_id, plan_name, status, started_at, current_period_end, created_at, updated_at;`,
    values
  );

  await query(
    `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
     VALUES ($1, $2, 'SUBSCRIPTION_STATUS_CHANGED');`,
    [businessId, adminUserId]
  );

  return mapToSafeSubscription(result.rows[0]);
}
