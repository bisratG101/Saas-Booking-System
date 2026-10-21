import { query } from "../../db";
import {
  parseDateString,
  getDayOfWeekForDate,
  localToUtc,
} from "../../utils/timezone";
import { AvailabilityResponse, AvailabilitySlot, BookingRecord, AvailabilityBlockRecord } from "./types";
import { BusinessRecord } from "../businesses/types";

export class BusinessNotFoundError extends Error {
  constructor(message = "Business not found") {
    super(message);
    this.name = "BusinessNotFoundError";
  }
}

export class BusinessSuspendedError extends Error {
  constructor(message = "Business is suspended and cannot accept bookings") {
    super(message);
    this.name = "BusinessSuspendedError";
  }
}

export class ServiceNotFoundError extends Error {
  constructor(message = "Service not found or does not belong to this business") {
    super(message);
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceInactiveError extends Error {
  constructor(message = "Service is inactive and not available for booking") {
    super(message);
    this.name = "ServiceInactiveError";
  }
}

export class DateOutOfWindowError extends Error {
  constructor(message = "Requested date is outside the allowed booking window") {
    super(message);
    this.name = "DateOutOfWindowError";
  }
}

export async function getAvailability(
  businessId: string,
  serviceId: string,
  dateStr: string,
  now: Date = new Date()
): Promise<AvailabilityResponse> {
  // 1. Verify business existence and active status
  const businessRes = await query<BusinessRecord>(
    "SELECT id, name, timezone, status FROM platform.businesses WHERE id = $1;",
    [businessId]
  );

  if (businessRes.rows.length === 0) {
    throw new BusinessNotFoundError();
  }

  const business = businessRes.rows[0];
  if (business.status !== "active") {
    throw new BusinessSuspendedError();
  }

  // 2. Verify service existence, active status, and business ownership
  const serviceRes = await query<{ id: string; is_active: boolean }>(
    "SELECT id, is_active FROM booking.services WHERE id = $1 AND business_id = $2;",
    [serviceId, businessId]
  );

  if (serviceRes.rows.length === 0) {
    throw new ServiceNotFoundError();
  }

  if (!serviceRes.rows[0].is_active) {
    throw new ServiceInactiveError();
  }

  // 3. Parse date string (YYYY-MM-DD)
  const { year, month, day } = parseDateString(dateStr);

  // 4. Validate date bounds against rolling 30-day window
  // Start of requested day in business timezone
  const dayStartUtc = localToUtc(year, month, day, 0, 0, business.timezone);
  // End of requested day (approx start of next day)
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const nowMs = now.getTime();
  const maxBookingMs = nowMs + 30 * 24 * 60 * 60 * 1000;

  if (dayEndUtc.getTime() <= nowMs) {
    throw new DateOutOfWindowError("Requested date is in the past");
  }

  if (dayStartUtc.getTime() > maxBookingMs) {
    throw new DateOutOfWindowError("Requested date is beyond the 30-day booking window");
  }

  // 5. Read business hours for this weekday (1=Monday, 7=Sunday)
  const dayOfWeek = getDayOfWeekForDate(year, month, day);

  const hoursRes = await query<{
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>(
    `SELECT open_time, close_time, is_closed
     FROM booking.business_hours
     WHERE business_id = $1 AND day_of_week = $2;`,
    [businessId, dayOfWeek]
  );

  if (hoursRes.rows.length === 0 || hoursRes.rows[0].is_closed || !hoursRes.rows[0].open_time || !hoursRes.rows[0].close_time) {
    return {
      businessId,
      serviceId,
      date: dateStr,
      timezone: business.timezone,
      slots: [],
    };
  }

  const { open_time, close_time } = hoursRes.rows[0];

  // 6. Generate possible 30-minute slots between open_time and close_time
  const [openH, openM] = open_time.split(":").map((v) => parseInt(v, 10));
  const [closeH, closeM] = close_time.split(":").map((v) => parseInt(v, 10));

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const candidateSlots: {
    slotStartUtc: Date;
    slotEndUtc: Date;
    localStartTime: string;
    localEndTime: string;
  }[] = [];

  for (let m = openMinutes; m + 30 <= closeMinutes; m += 30) {
    const sH = Math.floor(m / 60);
    const sM = m % 60;
    const eH = Math.floor((m + 30) / 60);
    const eM = (m + 30) % 60;

    const slotStartUtc = localToUtc(year, month, day, sH, sM, business.timezone);
    const slotEndUtc = new Date(slotStartUtc.getTime() + 30 * 60 * 1000);

    // Reject slots in the past or beyond 30-day rolling window
    if (slotStartUtc.getTime() <= nowMs || slotStartUtc.getTime() > maxBookingMs) {
      continue;
    }

    candidateSlots.push({
      slotStartUtc,
      slotEndUtc,
      localStartTime: `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`,
      localEndTime: `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`,
    });
  }

  if (candidateSlots.length === 0) {
    return {
      businessId,
      serviceId,
      date: dateStr,
      timezone: business.timezone,
      slots: [],
    };
  }

  // 7. Query confirmed bookings on this day
  const bookingsRes = await query<BookingRecord>(
    `SELECT start_time
     FROM booking.bookings
     WHERE business_id = $1
       AND status = 'confirmed'
       AND start_time >= $2
       AND start_time <= $3;`,
    [businessId, dayStartUtc, dayEndUtc]
  );

  const bookedInstants = new Set<number>(
    bookingsRes.rows.map((r) => new Date(r.start_time).getTime())
  );

  // 8. Query availability blocks overlapping this day
  const blocksRes = await query<AvailabilityBlockRecord>(
    `SELECT start_time, end_time
     FROM booking.availability_blocks
     WHERE business_id = $1
       AND start_time < $3
       AND end_time > $2;`,
    [businessId, dayStartUtc, dayEndUtc]
  );

  const blocks = blocksRes.rows.map((b) => ({
    startMs: new Date(b.start_time).getTime(),
    endMs: new Date(b.end_time).getTime(),
  }));

  // 9. Filter available slots
  const availableSlots: AvailabilitySlot[] = [];

  for (const candidate of candidateSlots) {
    const startMs = candidate.slotStartUtc.getTime();
    const endMs = candidate.slotEndUtc.getTime();

    // Check confirmed booking collision
    if (bookedInstants.has(startMs)) {
      continue;
    }

    // Check availability block collision (overlap: candidate.start < block.end && candidate.end > block.start)
    const collidesWithBlock = blocks.some(
      (block) => startMs < block.endMs && endMs > block.startMs
    );
    if (collidesWithBlock) {
      continue;
    }

    availableSlots.push({
      startTime: candidate.slotStartUtc.toISOString(),
      endTime: candidate.slotEndUtc.toISOString(),
      localStartTime: candidate.localStartTime,
      localEndTime: candidate.localEndTime,
    });
  }

  return {
    businessId,
    serviceId,
    date: dateStr,
    timezone: business.timezone,
    slots: availableSlots,
  };
}
