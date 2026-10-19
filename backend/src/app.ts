import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorHandler } from "./middleware/errorHandler";

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
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 4. 404 Not Found Middleware (must be after all valid routes)
  app.use(notFoundHandler);

  // 5. Central Error Handler (must be last middleware in the pipeline)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
