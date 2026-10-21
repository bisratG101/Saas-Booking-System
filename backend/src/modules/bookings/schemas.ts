import { z } from "zod";

export const availabilityQuerySchema = z.object({
  date: z
    .string({ required_error: "date query parameter is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
});

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;

export const createBookingSchema = z.object({
  business_id: z
    .string({ required_error: "business_id is required" })
    .uuid("business_id must be a valid UUID"),
  service_id: z
    .string({ required_error: "service_id is required" })
    .uuid("service_id must be a valid UUID"),
  start_time: z
    .string({ required_error: "start_time is required" })
    .datetime("start_time must be an ISO 8601 string (e.g. '2026-10-20T06:00:00.000Z')"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = z.object({
  status: z.enum(["confirmed", "cancelled"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format").optional(),
});

export type ListBookingsQueryInput = z.infer<typeof listBookingsQuerySchema>;
