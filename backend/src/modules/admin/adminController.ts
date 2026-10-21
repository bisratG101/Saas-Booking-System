import { Request, Response, NextFunction } from "express";
import {
  adminListBusinessesQuerySchema,
  adminChangeBusinessStatusSchema,
  adminListLogsQuerySchema,
} from "./schemas";
import {
  getPlatformStats,
  listBusinesses,
  getBusinessById,
  suspendBusiness,
  reactivateBusiness,
  listActivityLogs,
  BusinessNotFoundError,
  InvalidBusinessStatusError,
} from "./adminService";
import {
  updateSubscriptionSchema,
} from "../subscriptions/schemas";
import {
  adminUpdateSubscription,
  InvalidSubscriptionStatusError,
} from "../subscriptions/subscriptionService";

/**
 * Handle GET /api/v1/admin/stats
 */
export async function handleGetStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getPlatformStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/v1/admin/businesses
 */
export async function handleListBusinesses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedQuery = adminListBusinessesQuerySchema.parse(req.query);
    const result = await listBusinesses(validatedQuery);

    res.status(200).json({
      businesses: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/v1/admin/businesses/:businessId
 */
export async function handleGetBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    const business = await getBusinessById(businessId);

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
 * Handle POST /api/v1/admin/businesses/:businessId/suspend
 */
export async function handleSuspendBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    const business = await suspendBusiness(businessId, req.user!.id);

    res.status(200).json({
      business,
      message: "Business suspended successfully",
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidBusinessStatusError) {
      res.status(400).json({
        error: { code: "INVALID_STATUS_TRANSITION", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle POST /api/v1/admin/businesses/:businessId/reactivate
 */
export async function handleReactivateBusiness(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    const business = await reactivateBusiness(businessId, req.user!.id);

    res.status(200).json({
      business,
      message: "Business reactivated successfully",
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidBusinessStatusError) {
      res.status(400).json({
        error: { code: "INVALID_STATUS_TRANSITION", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle PATCH /api/v1/admin/businesses/:businessId/status
 */
export async function handleUpdateBusinessStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    const validatedInput = adminChangeBusinessStatusSchema.parse(req.body);

    const business =
      validatedInput.status === "suspended"
        ? await suspendBusiness(businessId, req.user!.id)
        : await reactivateBusiness(businessId, req.user!.id);

    res.status(200).json({
      business,
      message: `Business status updated to ${validatedInput.status}`,
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidBusinessStatusError) {
      res.status(400).json({
        error: { code: "INVALID_STATUS_TRANSITION", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle PATCH /api/v1/admin/businesses/:businessId/subscription
 */
export async function handleUpdateSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;

    const validatedInput = updateSubscriptionSchema.parse(req.body);
    const subscription = await adminUpdateSubscription(
      businessId,
      validatedInput,
      req.user!.id
    );

    res.status(200).json({
      subscription,
      message: "Subscription updated successfully",
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidSubscriptionStatusError) {
      res.status(400).json({
        error: { code: "INVALID_SUBSCRIPTION_STATUS", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/admin/activity-logs
 */
export async function handleListActivityLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedQuery = adminListLogsQuerySchema.parse(req.query);
    const result = await listActivityLogs(validatedQuery);

    res.status(200).json({
      logs: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}
