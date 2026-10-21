import { Request, Response, NextFunction } from "express";
import { setWeeklyHoursSchema } from "./schemas";
import { getWeeklyHours, setWeeklyHours } from "./hoursService";

/**
 * Handle GET /api/v1/businesses/me/hours
 * Returns the weekly working schedule for the authenticated owner's business.
 */
export async function handleGetWeeklyHours(
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
    const hours = await getWeeklyHours(req.business.id);

    res.status(200).json({
      hours,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle PUT /api/v1/businesses/me/hours
 * Atomically replaces the complete 7-day weekly working schedule.
 */
export async function handleSetWeeklyHours(
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
    const validatedInput = setWeeklyHoursSchema.parse(req.body);
    const hours = await setWeeklyHours(req.business.id, validatedInput, req.user?.id);

    res.status(200).json({
      hours,
    });
  } catch (err) {
    next(err);
  }
}
