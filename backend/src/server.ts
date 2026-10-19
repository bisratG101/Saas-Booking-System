import { app } from "./app";
import { env } from "./config/env";

/**
 * HTTP Server Entry Point
 *
 * Starts the HTTP listener and handles operating-system termination signals
 * (SIGTERM, SIGINT) for zero-downtime rolling deploys and safe shutdowns.
 */
const server = app.listen(env.PORT, () => {
  console.log(`🚀 SaaS Booking API server running on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  console.log(`🔒 Allowed CORS origins: ${env.CORS_ORIGIN}`);
});

function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Error during server close:", err);
      process.exit(1);
    }
    console.log("✅ HTTP server closed. Process exiting cleanly.");
    process.exit(0);
  });

  // Force close if server takes longer than 10 seconds to drain requests
  setTimeout(() => {
    console.error("⚠️ Forcing shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
