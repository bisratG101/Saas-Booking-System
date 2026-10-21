import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";

/**
 * Central Error Handling Middleware
 *
 * Catches all errors forwarded by next(err) or thrown asynchronously in Express 5.
 *
 * Security & Integrity:
 * - In production, never leak internal error messages or stack traces to the client.
 * - Format Zod validation errors cleanly so API clients can pinpoint invalid fields.
 * - Always emit consistent, machine-readable JSON: { error: { code, message, details? } }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle Body-Parser / Express malformed JSON SyntaxErrors
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as any).status === 400 &&
    "body" in err
  ) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload in request body",
      },
    });
    return;
  }

  // Handle standard JavaScript / Node errors
  if (err instanceof Error) {
    const isProduction = env.NODE_ENV === "production";

    // Always log full error details on the server for troubleshooting
    console.error("Unhandled Application Error:", err);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: isProduction
          ? "An unexpected error occurred. Please try again later."
          : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
      },
    });
    return;
  }

  // Handle non-Error throws (e.g., throw "something")
  console.error("Unknown Non-Error Thrown:", err);
  res.status(500).json({
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred.",
    },
  });
}
