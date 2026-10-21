import { Request, Response, NextFunction } from "express";

/**
 * Platform Admin Authorization Middleware
 *
 * Preconditions:
 * - Must be preceded by `authenticate` middleware (ensuring req.user exists).
 *
 * Responses:
 * - 401 Unauthorized if not authenticated.
 * - 403 Forbidden if authenticated user is not a platform_admin.
 */
export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
    return;
  }

  if (req.user.role !== "platform_admin") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Platform administrator authorization required",
      },
    });
    return;
  }

  next();
}
