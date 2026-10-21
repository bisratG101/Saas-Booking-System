import { z } from "zod";

/**
 * Validates whether a string is a recognized IANA timezone identifier
 * using the JavaScript V8 standard Intl API.
 */
export function isValidIANATimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const createBusinessSchema = z.object({
  name: z
    .string({ required_error: "Business name is required" })
    .trim()
    .min(1, "Business name cannot be empty")
    .max(255, "Business name cannot exceed 255 characters"),
  timezone: z
    .string({ required_error: "Timezone is required" })
    .trim()
    .refine(isValidIANATimezone, {
      message: "Invalid IANA timezone identifier (e.g. 'Africa/Addis_Ababa', 'America/New_York', 'UTC')",
    }),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Business name cannot be empty")
      .max(255, "Business name cannot exceed 255 characters")
      .optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidIANATimezone, {
        message: "Invalid IANA timezone identifier (e.g. 'Africa/Addis_Ababa', 'America/New_York', 'UTC')",
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.timezone !== undefined, {
    message: "At least one field ('name' or 'timezone') must be provided for update",
  });

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export const createServiceSchema = z.object({
  name: z
    .string({ required_error: "Service name is required" })
    .trim()
    .min(1, "Service name cannot be empty")
    .max(255, "Service name cannot exceed 255 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .nullable(),
  duration_minutes: z
    .number()
    .refine((val) => val === 30, {
      message: "In V1, all services must have a duration of exactly 30 minutes",
    })
    .default(30),
  price: z
    .number({ required_error: "Price is required" })
    .min(0, "Price must be non-negative"),
  is_active: z.boolean().default(true),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Service name cannot be empty")
      .max(255, "Service name cannot exceed 255 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional()
      .nullable(),
    duration_minutes: z
      .number()
      .refine((val) => val === 30, {
        message: "In V1, all services must have a duration of exactly 30 minutes",
      })
      .optional(),
    price: z
      .number()
      .min(0, "Price must be non-negative")
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.duration_minutes !== undefined ||
      data.price !== undefined ||
      data.is_active !== undefined,
    {
      message: "At least one field must be provided for service update",
    }
  );

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Single Day Business Hour Schema
 */
export const businessHourDaySchema = z
  .object({
    day_of_week: z
      .number({ required_error: "day_of_week is required" })
      .int("day_of_week must be an integer")
      .min(1, "day_of_week must be between 1 (Monday) and 7 (Sunday)")
      .max(7, "day_of_week must be between 1 (Monday) and 7 (Sunday)"),
    is_closed: z.boolean().default(false),
    open_time: z
      .string()
      .trim()
      .regex(timeFormatRegex, "open_time must be in HH:MM 24-hour format (e.g. '09:00')")
      .nullable()
      .optional(),
    close_time: z
      .string()
      .trim()
      .regex(timeFormatRegex, "close_time must be in HH:MM 24-hour format (e.g. '17:00')")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.is_closed) {
      return;
    }

    if (!data.open_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "open_time is required when is_closed is false",
        path: ["open_time"],
      });
    }

    if (!data.close_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "close_time is required when is_closed is false",
        path: ["close_time"],
      });
    }

    if (data.open_time && data.close_time) {
      // Compare HH:MM format (e.g. "17:00" vs "09:00")
      // Normalize by taking first 5 characters (HH:MM)
      const open = data.open_time.slice(0, 5);
      const close = data.close_time.slice(0, 5);
      if (close <= open) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "close_time must be later than open_time on the same local day",
          path: ["close_time"],
        });
      }
    }
  });

export type BusinessHourDayInput = z.infer<typeof businessHourDaySchema>;

/**
 * Complete Weekly Schedule Replacement Schema
 */
export const setWeeklyHoursSchema = z.object({
  hours: z
    .array(businessHourDaySchema)
    .length(7, "A complete weekly schedule must contain exactly 7 days (days 1 through 7)")
    .refine(
      (days) => {
        const weekdays = new Set(days.map((d) => d.day_of_week));
        return weekdays.size === 7 && [1, 2, 3, 4, 5, 6, 7].every((d) => weekdays.has(d));
      },
      {
        message: "Schedule must contain exactly one entry for each day from 1 (Monday) to 7 (Sunday)",
        path: ["hours"],
      }
    ),
});

export type SetWeeklyHoursInput = z.infer<typeof setWeeklyHoursSchema>;

