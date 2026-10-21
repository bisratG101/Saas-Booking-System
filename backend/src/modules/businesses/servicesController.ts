import { Request, Response, NextFunction } from "express";
import { createServiceSchema, updateServiceSchema } from "./schemas";
import {
  createService,
  listServicesByBusinessId,
  listActiveServicesByBusinessId,
  getServiceById,
  updateService,
  deactivateService,
  ServiceNotFoundError,
} from "./servicesService";
import { getBusinessById } from "./businessService";

/**
 * Handle POST /api/v1/businesses/me/services
 */
export async function handleCreateService(
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
    const validatedInput = createServiceSchema.parse(req.body);
    const service = await createService(req.business.id, validatedInput);

    res.status(201).json({
      service,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses/me/services
 */
export async function handleListMyServices(
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
    const services = await listServicesByBusinessId(req.business.id);

    res.status(200).json({
      services,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses/me/services/:serviceId
 */
export async function handleGetMyService(
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
    const serviceId = Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId;
    const service = await getServiceById(req.business.id, serviceId);

    if (!service) {
      res.status(404).json({
        error: { code: "SERVICE_NOT_FOUND", message: "Service not found" },
      });
      return;
    }

    res.status(200).json({
      service,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle PATCH /api/v1/businesses/me/services/:serviceId
 */
export async function handleUpdateMyService(
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
    const serviceId = Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId;
    const validatedInput = updateServiceSchema.parse(req.body);
    const service = await updateService(req.business.id, serviceId, validatedInput);

    res.status(200).json({
      service,
    });
  } catch (err) {
    if (err instanceof ServiceNotFoundError) {
      res.status(404).json({
        error: { code: "SERVICE_NOT_FOUND", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle DELETE /api/v1/businesses/me/services/:serviceId and PATCH /api/v1/businesses/me/services/:serviceId/deactivate
 */
export async function handleDeactivateMyService(
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
    const serviceId = Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId;
    const service = await deactivateService(req.business.id, serviceId);

    res.status(200).json({
      service,
      message: "Service deactivated successfully",
    });
  } catch (err) {
    if (err instanceof ServiceNotFoundError) {
      res.status(404).json({
        error: { code: "SERVICE_NOT_FOUND", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses/:businessId/services
 * Public endpoint to list active services for a given business.
 */
export async function handleListPublicBusinessServices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    if (!businessId) {
      res.status(400).json({
        error: { code: "INVALID_BUSINESS_ID", message: "businessId parameter is required" },
      });
      return;
    }

    // 1. Verify business exists
    const business = await getBusinessById(businessId);
    if (!business) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: "Business not found" },
      });
      return;
    }

    // 2. Reject if business is suspended
    if (business.status !== "active") {
      res.status(403).json({
        error: {
          code: "BUSINESS_SUSPENDED",
          message: "Business is suspended and its services are not available",
        },
      });
      return;
    }

    // 3. Return active services belonging strictly to this business
    const services = await listActiveServicesByBusinessId(businessId);

    res.status(200).json({
      services,
    });
  } catch (err) {
    next(err);
  }
}
