import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Environment Schema Definition
 * 
 * We use Zod to validate process.env at startup.
 * If any required environment variable is missing or malformed,
 * the application will throw a descriptive error and refuse to boot.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z
    .string()
    .default("4000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive().max(65535)),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL")
    .optional(),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long for cryptographic security")
    .default("dev-only-insecure-secret-key-32-chars-minimum!"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables at application startup:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error("Invalid environment configuration. Check your .env file.");
}

export type Env = z.infer<typeof envSchema>;
export const env = parsed.data;
