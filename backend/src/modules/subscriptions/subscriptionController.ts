import { Request, Response, NextFunction } from "express";
import {
  getSubscriptionByBusinessId,
  cancelOwnerSubscription,
  InvalidSubscriptionStatusError,
} from "./subscriptionService";

/**
 * Handle GET /api/v1/businesses/me/subscription
 * Authenticated owner retrieves their own business's subscription.
 */
export async function handleGetMySubscription(
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
    const subscription = await getSubscriptionByBusinessId(req.business.id);

    res.status(200).json({
      subscription,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle POST /api/v1/businesses/me/subscription/cancel
 * Authenticated owner cancels their subscription.
 */
export async function handleCancelMySubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.business || !req.user) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Business authorization required" },
    });
    return;
  }

  try {
    const subscription = await cancelOwnerSubscription(
      req.business.id,
      req.user.id
    );

    res.status(200).json({
      subscription,
      message: "Subscription cancelled successfully",
    });
  } catch (err) {
    if (err instanceof InvalidSubscriptionStatusError) {
      res.status(400).json({
        error: { code: "INVALID_SUBSCRIPTION_STATUS", message: err.message },
      });
      return;
    }
    next(err);
  }
}
