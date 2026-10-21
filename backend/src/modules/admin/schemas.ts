import { z } from "zod";

export const adminListBusinessesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
  status: z.enum(["active", "suspended"]).optional(),
  search: z.string().trim().optional(),
});

export type AdminListBusinessesQueryInput = z.infer<typeof adminListBusinessesQuerySchema>;

export const adminChangeBusinessStatusSchema = z.object({
  status: z.enum(["active", "suspended"], {
    required_error: "status is required ('active' or 'suspended')",
  }),
});

export type AdminChangeBusinessStatusInput = z.infer<typeof adminChangeBusinessStatusSchema>;

export const adminListLogsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
  business_id: z.string().uuid().optional(),
  action: z.string().trim().optional(),
});

export type AdminListLogsQueryInput = z.infer<typeof adminListLogsQuerySchema>;
