/**
 * Timezone & Date Calculation Utilities
 *
 * Provides timezone-aware conversions between local wall-clock calendar times
 * and UTC instants without relying on the host machine's local timezone.
 */

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Validate calendar bounds
  if (month < 1 || month > 12) {
    throw new Error("Invalid month in date.");
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    throw new Error(`Invalid day for month ${month}. Must be between 1 and ${daysInMonth}.`);
  }

  return { year, month, day };
}

/**
 * Returns the ISO day of the week for a given calendar date (1 = Monday, 7 = Sunday).
 */
export function getDayOfWeekForDate(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day));
  const jsDay = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return jsDay === 0 ? 7 : jsDay;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  let h = parseInt(p.hour, 10);
  if (h === 24) h = 0;
  const asUtc = Date.UTC(
    parseInt(p.year, 10),
    parseInt(p.month, 10) - 1,
    parseInt(p.day, 10),
    h,
    parseInt(p.minute, 10),
    parseInt(p.second, 10)
  );
  return asUtc - date.getTime();
}

/**
 * Converts a local wall-clock date and time in an arbitrary IANA timezone to a UTC instant.
 * Accurately handles standard and daylight-saving time offsets.
 */
export function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset1 = getTimeZoneOffsetMs(utcGuess, timeZone);
  const utcDate = new Date(utcGuess.getTime() - offset1);
  const offset2 = getTimeZoneOffsetMs(utcDate, timeZone);
  if (offset1 !== offset2) {
    return new Date(utcGuess.getTime() - offset2);
  }
  return utcDate;
}

/**
 * Formats a UTC instant into local HH:MM (24-hour) in the specified IANA timezone.
 */
export function utcToLocalTimeString(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  let h = parseInt(p.hour, 10);
  if (h === 24) h = 0;
  return `${String(h).padStart(2, "0")}:${p.minute}`;
}

/**
 * Checks if a slot instant falls strictly within the rolling 30-day window:
 * now < slotInstant <= now + 30 days
 */
export function isWithin30DayWindow(slotInstant: Date, now: Date = new Date()): boolean {
  const slotMs = slotInstant.getTime();
  const nowMs = now.getTime();
  const maxMs = nowMs + 30 * 24 * 60 * 60 * 1000;
  return slotMs > nowMs && slotMs <= maxMs;
}
