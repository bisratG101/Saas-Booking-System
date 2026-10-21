import { z } from "zod";

/**
 * Public Customer Registration Schema
 *
 * Strict validation:
 * - Role cannot be chosen by the client; public registration always registers a 'customer'.
 * - Password length: 8 - 128 characters.
 * - Email format validated.
 */
export const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(255, "Name cannot exceed 255 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format")
    .max(255, "Email cannot exceed 255 characters"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number cannot exceed 50 characters")
    .optional()
    .nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Unified Login Schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(128, "Password cannot exceed 128 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
