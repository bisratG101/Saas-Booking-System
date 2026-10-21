import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { AuthTokenPayload } from "./types";

export class AuthTokenError extends Error {
  constructor(message: string, public readonly code: "TOKEN_EXPIRED" | "TOKEN_INVALID") {
    super(message);
    this.name = "AuthTokenError";
  }
}

/**
 * Signs a JWT for an authenticated user with a 1-hour expiration per design.md.
 */
export function signToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: "1h",
    algorithm: "HS256",
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Verifies a JWT token signature, expiration, and expected payload shape.
 * Throws AuthTokenError if invalid or expired.
 */
export function verifyToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;

    if (!decoded || typeof decoded !== "object" || !decoded.sub || !decoded.role || !decoded.email) {
      throw new AuthTokenError("Invalid token payload structure", "TOKEN_INVALID");
    }

    return {
      sub: decoded.sub as string,
      role: decoded.role as any,
      email: decoded.email as string,
    };
  } catch (err: any) {
    if (err instanceof AuthTokenError) {
      throw err;
    }
    if (err.name === "TokenExpiredError") {
      throw new AuthTokenError("Token has expired", "TOKEN_EXPIRED");
    }
    throw new AuthTokenError("Invalid or malformed token", "TOKEN_INVALID");
  }
}
