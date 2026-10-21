import { query, getClient } from "../../db";
import { SetWeeklyHoursInput } from "./schemas";
import { BusinessHourRecord, SafeBusinessHour } from "./types";

function formatTimeString(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

function mapToSafeBusinessHour(row: BusinessHourRecord): SafeBusinessHour {
  return {
    id: row.id,
    businessId: row.business_id,
    dayOfWeek: Number(row.day_of_week),
    openTime: formatTimeString(row.open_time),
    closeTime: formatTimeString(row.close_time),
    isClosed: Boolean(row.is_closed),
  };
}

/**
 * Retrieves the configured weekly schedule for a business ordered by weekday (1=Monday to 7=Sunday).
 */
export async function getWeeklyHours(businessId: string): Promise<SafeBusinessHour[]> {
  const result = await query<BusinessHourRecord>(
    `SELECT id, business_id, day_of_week, open_time, close_time, is_closed
     FROM booking.business_hours
     WHERE business_id = $1
     ORDER BY day_of_week ASC;`,
    [businessId]
  );

  return result.rows.map(mapToSafeBusinessHour);
}

/**
 * Atomically replaces the complete weekly schedule for a business.
 *
 * Execution:
 * - Runs within a database transaction.
 * - Upserts 7 weekday records (days 1 through 7).
 * - Enforces check constraints (close_time > open_time when open; null times when closed).
 * - Writes an audit activity log.
 * - Rolls back atomically on any failure, leaving no partial state.
 */
export async function setWeeklyHours(
  businessId: string,
  input: SetWeeklyHoursInput,
  actorUserId?: string
): Promise<SafeBusinessHour[]> {
  const client = await getClient();

  try {
    await client.query("BEGIN;");

    const updatedRows: BusinessHourRecord[] = [];

    // Sort days from 1 to 7 for deterministic insertion
    const sortedDays = [...input.hours].sort((a, b) => a.day_of_week - b.day_of_week);

    for (const day of sortedDays) {
      const openTime = day.is_closed ? null : day.open_time?.slice(0, 5) ?? null;
      const closeTime = day.is_closed ? null : day.close_time?.slice(0, 5) ?? null;

      const result = await client.query<BusinessHourRecord>(
        `INSERT INTO booking.business_hours (business_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (business_id, day_of_week) DO UPDATE
         SET
           open_time = EXCLUDED.open_time,
           close_time = EXCLUDED.close_time,
           is_closed = EXCLUDED.is_closed
         RETURNING id, business_id, day_of_week, open_time, close_time, is_closed;`,
        [businessId, day.day_of_week, openTime, closeTime, day.is_closed]
      );

      updatedRows.push(result.rows[0]);
    }

    // Write audit log
    await client.query(
      `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
       VALUES ($1, $2, 'BUSINESS_HOURS_UPDATED');`,
      [businessId, actorUserId ?? null]
    );

    await client.query("COMMIT;");
    return updatedRows.map(mapToSafeBusinessHour);
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    client.release();
  }
}
