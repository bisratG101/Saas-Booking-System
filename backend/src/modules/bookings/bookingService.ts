import { query } from "../../db";
import { isWithin30DayWindow, utcToLocalTimeString, getDayOfWeekForDate } from "../../utils/timezone";
import { CreateBookingInput } from "./schemas";
import { BookingRecord, SafeBooking, AvailabilityBlockRecord } from "./types";
import { BusinessRecord } from "../businesses/types";
import {
  BusinessNotFoundError,
  BusinessSuspendedError,
  ServiceNotFoundError,
  ServiceInactiveError,
} from "./availabilityService";

export class BookingNotFoundError extends Error {
  constructor(message = "Booking not found") {
    super(message);
    this.name = "BookingNotFoundError";
  }
}

export class SlotConflictError extends Error {
  constructor(message = "This appointment slot has already been booked") {
    super(message);
    this.name = "SlotConflictError";
  }
}

export class InvalidBookingTimeError extends Error {
  constructor(message = "Invalid booking time") {
    super(message);
    this.name = "InvalidBookingTimeError";
  }
}

export class CancellationDeadlinePassedError extends Error {
  constructor(message = "Bookings can only be cancelled at least 2 hours before the appointment start time") {
    super(message);
    this.name = "CancellationDeadlinePassedError";
  }
}

export class BookingAlreadyCancelledError extends Error {
  constructor(message = "Booking is already cancelled") {
    super(message);
    this.name = "BookingAlreadyCancelledError";
  }
}

export class ForbiddenBookingError extends Error {
  constructor(message = "Unauthorized booking operation") {
    super(message);
    this.name = "ForbiddenBookingError";
  }
}

function mapToSafeBooking(row: BookingRecord): SafeBooking {
  const start = new Date(row.start_time);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    cancelledAt: row.cancelled_at ? (row.cancelled_at instanceof Date ? row.cancelled_at.toISOString() : String(row.cancelled_at)) : null,
  };
}

/**
 * Creates an appointment booking for an authenticated customer.
 * Concurrency is guaranteed by the database partial unique index:
 * booking.bookings (business_id, start_time) WHERE status = 'confirmed'.
 */
export async function createCustomerBooking(
  customerId: string,
  input: CreateBookingInput,
  now: Date = new Date()
): Promise<SafeBooking> {
  const startInstant = new Date(input.start_time);
  if (isNaN(startInstant.getTime())) {
    throw new InvalidBookingTimeError("Invalid start_time format");
  }

  // 1. Enforce rolling 30-day booking window
  if (!isWithin30DayWindow(startInstant, now)) {
    throw new InvalidBookingTimeError(
      "Booking start time must be in the future and no more than 30 days ahead"
    );
  }

  // 2. Verify business existence and active status
  const businessRes = await query<BusinessRecord>(
    "SELECT id, timezone, status FROM platform.businesses WHERE id = $1;",
    [input.business_id]
  );

  if (businessRes.rows.length === 0) {
    throw new BusinessNotFoundError("Business not found");
  }

  const business = businessRes.rows[0];
  if (business.status !== "active") {
    throw new BusinessSuspendedError("Business is suspended and cannot accept new bookings");
  }

  // 3. Verify service existence, active status, and belonging to business
  const serviceRes = await query<{ id: string; is_active: boolean }>(
    "SELECT id, is_active FROM booking.services WHERE id = $1 AND business_id = $2;",
    [input.service_id, input.business_id]
  );

  if (serviceRes.rows.length === 0) {
    throw new ServiceNotFoundError("Service not found or does not belong to this business");
  }

  if (!serviceRes.rows[0].is_active) {
    throw new ServiceInactiveError("Service is inactive and cannot be booked");
  }

  // 4. Validate slot alignment (30-minute boundary in business timezone)
  const localTimeStr = utcToLocalTimeString(startInstant, business.timezone);
  const [localH, localM] = localTimeStr.split(":").map((v) => parseInt(v, 10));

  if (localM !== 0 && localM !== 30) {
    throw new InvalidBookingTimeError(
      "Appointment slots must start on exact 30-minute boundaries (:00 or :30)"
    );
  }

  // 5. Verify local working hours
  // Determine local date parts in business timezone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(startInstant);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  const localYear = parseInt(p.year, 10);
  const localMonth = parseInt(p.month, 10);
  const localDay = parseInt(p.day, 10);
  const dayOfWeek = getDayOfWeekForDate(localYear, localMonth, localDay);

  const hoursRes = await query<{
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>(
    `SELECT open_time, close_time, is_closed
     FROM booking.business_hours
     WHERE business_id = $1 AND day_of_week = $2;`,
    [input.business_id, dayOfWeek]
  );

  if (hoursRes.rows.length === 0 || hoursRes.rows[0].is_closed || !hoursRes.rows[0].open_time || !hoursRes.rows[0].close_time) {
    throw new InvalidBookingTimeError("Business is closed on the requested day");
  }

  const { open_time, close_time } = hoursRes.rows[0];
  const [openH, openM] = open_time.split(":").map((v) => parseInt(v, 10));
  const [closeH, closeM] = close_time.split(":").map((v) => parseInt(v, 10));

  const slotStartMinutes = localH * 60 + localM;
  const slotEndMinutes = slotStartMinutes + 30;
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (slotStartMinutes < openMinutes || slotEndMinutes > closeMinutes) {
    throw new InvalidBookingTimeError("Requested time slot is outside business working hours");
  }

  // 6. Check availability blocks
  const slotEndInstant = new Date(startInstant.getTime() + 30 * 60 * 1000);
  const blocksRes = await query<AvailabilityBlockRecord>(
    `SELECT id
     FROM booking.availability_blocks
     WHERE business_id = $1
       AND start_time < $3
       AND end_time > $2;`,
    [input.business_id, startInstant, slotEndInstant]
  );

  if (blocksRes.rows.length > 0) {
    throw new SlotConflictError("The requested slot overlaps an availability block");
  }

  // 7. Insert booking (Protected against double-booking by unique partial index)
  try {
    const bookingRes = await query<BookingRecord>(
      `INSERT INTO booking.bookings (business_id, customer_id, service_id, start_time, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at;`,
      [input.business_id, customerId, input.service_id, startInstant]
    );

    // Audit log
    await query(
      `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
       VALUES ($1, $2, 'BOOKING_CREATED');`,
      [input.business_id, customerId]
    );

    return mapToSafeBooking(bookingRes.rows[0]);
  } catch (err: any) {
    // Catch unique index violation (PostgreSQL code 23505)
    if (err.code === "23505") {
      throw new SlotConflictError("This appointment slot has already been booked");
    }
    throw err;
  }
}

/**
 * List customer bookings (scoped to customer_id).
 */
export async function listCustomerBookings(
  customerId: string,
  status?: string
): Promise<SafeBooking[]> {
  const result = await query<BookingRecord>(
    `SELECT id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at
     FROM booking.bookings
     WHERE customer_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY start_time DESC;`,
    [customerId, status ?? null]
  );

  return result.rows.map(mapToSafeBooking);
}

/**
 * Get individual customer booking by ID (scoped to customer_id).
 */
export async function getCustomerBookingById(
  customerId: string,
  bookingId: string
): Promise<SafeBooking | null> {
  const result = await query<BookingRecord>(
    `SELECT id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at
     FROM booking.bookings
     WHERE id = $1 AND customer_id = $2;`,
    [bookingId, customerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapToSafeBooking(result.rows[0]);
}

/**
 * Customer booking cancellation:
 * Allowed when at least 2 hours remain before start_time (including exactly 2 hours).
 */
export async function cancelCustomerBooking(
  customerId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<SafeBooking> {
  const checkRes = await query<BookingRecord>(
    `SELECT id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at
     FROM booking.bookings
     WHERE id = $1 AND customer_id = $2;`,
    [bookingId, customerId]
  );

  if (checkRes.rows.length === 0) {
    throw new BookingNotFoundError();
  }

  const booking = checkRes.rows[0];

  if (booking.status === "cancelled") {
    throw new BookingAlreadyCancelledError();
  }

  // Two-hour rule: (start_time - now) >= 2 hours
  const startMs = new Date(booking.start_time).getTime();
  const nowMs = now.getTime();
  const diffHours = (startMs - nowMs) / (1000 * 60 * 60);

  if (diffHours < 2) {
    throw new CancellationDeadlinePassedError();
  }

  const updateRes = await query<BookingRecord>(
    `UPDATE booking.bookings
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND customer_id = $2 AND status = 'confirmed'
     RETURNING id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at;`,
    [bookingId, customerId]
  );

  await query(
    `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
     VALUES ($1, $2, 'BOOKING_CANCELLED');`,
    [booking.business_id, customerId]
  );

  return mapToSafeBooking(updateRes.rows[0]);
}

/**
 * List owner bookings (scoped to business_id).
 */
export async function listOwnerBookings(
  businessId: string,
  status?: string,
  dateStr?: string
): Promise<SafeBooking[]> {
  const result = await query<BookingRecord>(
    `SELECT id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at
     FROM booking.bookings
     WHERE business_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY start_time ASC;`,
    [businessId, status ?? null]
  );

  return result.rows.map(mapToSafeBooking);
}

/**
 * Owner booking cancellation:
 * Allowed at any time for the owner's authorized business.
 */
export async function cancelOwnerBooking(
  businessId: string,
  bookingId: string,
  actorUserId?: string
): Promise<SafeBooking> {
  const checkRes = await query<BookingRecord>(
    `SELECT id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at
     FROM booking.bookings
     WHERE id = $1 AND business_id = $2;`,
    [bookingId, businessId]
  );

  if (checkRes.rows.length === 0) {
    throw new BookingNotFoundError();
  }

  const booking = checkRes.rows[0];

  if (booking.status === "cancelled") {
    throw new BookingAlreadyCancelledError();
  }

  const updateRes = await query<BookingRecord>(
    `UPDATE booking.bookings
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND business_id = $2 AND status = 'confirmed'
     RETURNING id, business_id, customer_id, service_id, start_time, status, created_at, updated_at, cancelled_at;`,
    [bookingId, businessId]
  );

  await query(
    `INSERT INTO platform.activity_logs (business_id, actor_user_id, action)
     VALUES ($1, $2, 'BOOKING_CANCELLED_BY_OWNER');`,
    [businessId, actorUserId ?? null]
  );

  return mapToSafeBooking(updateRes.rows[0]);
}
