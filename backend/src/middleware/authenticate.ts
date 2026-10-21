import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenError } from "../modules/auth/jwt";
import { UserRole } from "../modules/auth/types";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
}

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication Middleware
 *
 * Verifies JWT bearer token from the Authorization header.
 * Attaches user identity to req.user.
 *
 * Returns 401 Unauthorized if token is missing, malformed, expired, or invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authorization token required",
      },
    });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1].trim()) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authorization format. Expected 'Bearer <token>'",
      },
    });
    return;
  }

  const token = parts[1].trim();

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (err) {
    if (err instanceof AuthTokenError) {
      res.status(401).json({
        error: {
          code: err.code === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
          message: err.message,
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Token verification failed",
      },
    });
  }
}
