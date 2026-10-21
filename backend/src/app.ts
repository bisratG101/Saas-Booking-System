import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorHandler } from "./middleware/errorHandler";
import { checkDatabaseHealth } from "./db";
import { authRoutes } from "./modules/auth/authRoutes";
import { businessRoutes } from "./modules/businesses/businessRoutes";
import { bookingRoutes } from "./modules/bookings/bookingRoutes";
import { adminRoutes } from "./modules/admin/adminRoutes";

/**
 * Express Application Factory
 *
 * Separating the app definition from the HTTP server (server.ts) allows us to:
 * 1. Import `app` directly into integration tests without starting network listeners.
 * 2. Keep server lifecycle concerns (port binding, shutdown signals) isolated.
 */
export function createApp(): Application {
  const app = express();

  // 1. CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server calls)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(new Error(`CORS error: Origin '${origin}' is not allowed`));
        }
      },
      credentials: true,
    })
  );

  // 2. Request Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. Health Check Endpoint
  // Used by deployment monitors (like Render or Vercel) and uptime checkers
  app.get("/health", async (_req, res) => {
    const dbHealth = await checkDatabaseHealth();

    const isHealthy = !dbHealth.isConfigured || dbHealth.isHealthy;
    const statusCode = isHealthy ? 200 : 503;

    let dbStatus: "unconfigured" | "connected" | "disconnected" = "unconfigured";
    if (dbHealth.isConfigured) {
      dbStatus = dbHealth.isHealthy ? "connected" : "disconnected";
    }

    res.status(statusCode).json({
      status: isHealthy ? "ok" : "degraded",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        ...(dbStatus === "disconnected" ? { error: "Database unreachable" } : {}),
      },
    });
  });

  // 4. API Domain Routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/businesses", businessRoutes);
  app.use("/api/v1/bookings", bookingRoutes);
  app.use("/api/v1/admin", adminRoutes);

  // Fallback aliases for clients configuring base domain without /api/v1
  app.use("/auth", authRoutes);
  app.use("/businesses", businessRoutes);
  app.use("/bookings", bookingRoutes);
  app.use("/admin", adminRoutes);

  // 5. 404 Not Found Middleware (must be after all valid routes)
  app.use(notFoundHandler);

  // 6. Central Error Handler (must be last middleware in the pipeline)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
