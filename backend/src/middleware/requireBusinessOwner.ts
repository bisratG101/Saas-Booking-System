import { Request, Response, NextFunction } from "express";
import { query } from "../db";
import { BusinessRecord } from "../modules/businesses/types";

export interface AuthenticatedBusiness {
  id: string;
  ownerId: string;
  name: string;
  timezone: string;
  status: "active" | "suspended";
}

declare global {
  namespace Express {
    interface Request {
      business?: AuthenticatedBusiness;
    }
  }
}

/**
 * Business Ownership Middleware
 *
 * Resolves the authenticated owner's business directly from PostgreSQL.
 * NEVER trusts business_id supplied by the client in request bodies, query strings, or headers.
 *
 * Preconditions:
 * - Must be preceded by `authenticate` middleware (ensuring req.user exists).
 *
 * Responses:
 * - 401 Unauthorized if not authenticated.
 * - 403 Forbidden if user does not own any registered business.
 */
export async function requireBusinessOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
    return;
  }

  try {
    const result = await query<BusinessRecord>(
      `SELECT id, owner_id, name, timezone, status
       FROM platform.businesses
       WHERE owner_id = $1;`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "User does not own a business",
        },
      });
      return;
    }

    const business = result.rows[0];

    req.business = {
      id: business.id,
      ownerId: business.owner_id,
      name: business.name,
      timezone: business.timezone,
      status: business.status,
    };

    next();
  } catch (err) {
    next(err);
  }
}
