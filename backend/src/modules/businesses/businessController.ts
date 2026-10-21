import { Request, Response, NextFunction } from "express";
import { createBusinessSchema, updateBusinessSchema } from "./schemas";
import {
  createBusiness,
  getBusinessByOwnerId,
  updateBusiness,
  listActiveBusinesses,
  BusinessAlreadyExistsError,
  BusinessNotFoundError,
  ForbiddenOperationError,
} from "./businessService";

/**
 * Handle POST /api/v1/businesses
 * Creates a business for the authenticated user and transitions role to business_owner.
 */
export async function handleCreateBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const validatedInput = createBusinessSchema.parse(req.body);
    const business = await createBusiness(req.user.id, validatedInput);

    res.status(201).json({
      business,
    });
  } catch (err) {
    if (err instanceof BusinessAlreadyExistsError) {
      res.status(409).json({
        error: { code: "BUSINESS_ALREADY_EXISTS", message: err.message },
      });
      return;
    }
    if (err instanceof ForbiddenOperationError) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses/me
 * Retrieves the authenticated owner's business profile.
 */
export async function handleGetMyBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const business = await getBusinessByOwnerId(req.user.id);

    if (!business) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: "User does not own a business" },
      });
      return;
    }

    res.status(200).json({
      business,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle PATCH /api/v1/businesses/me
 * Updates the authenticated owner's business details.
 */
export async function handleUpdateMyBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.business) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Business authorization required" },
    });
    return;
  }

  try {
    const validatedInput = updateBusinessSchema.parse(req.body);
    const business = await updateBusiness(req.business.id, validatedInput);

    res.status(200).json({
      business,
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses
 * Lists all publicly active businesses. Suspended businesses are excluded.
 */
export async function handleListPublicBusinesses(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businesses = await listActiveBusinesses();
    res.status(200).json({
      businesses,
    });
  } catch (err) {
    next(err);
  }
}
