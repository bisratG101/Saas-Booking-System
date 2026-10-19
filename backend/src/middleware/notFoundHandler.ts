import { Request, Response, NextFunction } from "express";

/**
 * 404 Not Found Middleware
 *
 * Catch-all handler for requests that did not match any defined route.
 * Emits a structured JSON error response following RFC 7807 principles.
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}
