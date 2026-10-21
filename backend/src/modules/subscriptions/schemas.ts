import { z } from "zod";

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "cancelled", "suspended"] as const;
export const ALLOWED_PLANS = ["starter", "pro", "enterprise"] as const;

export const updateSubscriptionSchema = z
  .object({
    plan_name: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "plan_name cannot be empty")
      .max(100, "plan_name cannot exceed 100 characters")
      .optional(),
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  })
  .refine((data) => data.plan_name !== undefined || data.status !== undefined, {
    message: "At least one field ('plan_name' or 'status') must be provided for update",
  });

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
