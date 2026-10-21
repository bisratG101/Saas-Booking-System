import { Request, Response, NextFunction } from "express";
import {
  availabilityQuerySchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from "./schemas";
import {
  getAvailability,
  BusinessNotFoundError,
  BusinessSuspendedError,
  ServiceNotFoundError,
  ServiceInactiveError,
  DateOutOfWindowError,
} from "./availabilityService";
import {
  createCustomerBooking,
  listCustomerBookings,
  getCustomerBookingById,
  cancelCustomerBooking,
  listOwnerBookings,
  cancelOwnerBooking,
  BookingNotFoundError,
  BookingAlreadyCancelledError,
  CancellationDeadlinePassedError,
  SlotConflictError,
  InvalidBookingTimeError,
} from "./bookingService";

/**
 * Handle GET /api/v1/businesses/:businessId/services/:serviceId/availability?date=YYYY-MM-DD
 * Public or authenticated endpoint for calculating 30-minute booking slots.
 */
export async function handleGetAvailability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = Array.isArray(req.params.businessId)
      ? req.params.businessId[0]
      : req.params.businessId;
    const serviceId = Array.isArray(req.params.serviceId)
      ? req.params.serviceId[0]
      : req.params.serviceId;

    const validatedQuery = availabilityQuerySchema.parse(req.query);

    const availability = await getAvailability(
      businessId,
      serviceId,
      validatedQuery.date
    );

    res.status(200).json(availability);
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof BusinessSuspendedError) {
      res.status(403).json({
        error: { code: "BUSINESS_SUSPENDED", message: err.message },
      });
      return;
    }
    if (err instanceof ServiceNotFoundError) {
      res.status(404).json({
        error: { code: "SERVICE_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof ServiceInactiveError) {
      res.status(400).json({
        error: { code: "SERVICE_INACTIVE", message: err.message },
      });
      return;
    }
    if (err instanceof DateOutOfWindowError) {
      res.status(400).json({
        error: { code: "DATE_OUT_OF_WINDOW", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidBookingTimeError) {
      res.status(400).json({
        error: { code: "INVALID_BOOKING_TIME", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle POST /api/v1/bookings
 * Authenticated customer creates a new appointment booking.
 */
export async function handleCreateBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  // Role enforcement: Customer-only booking creation
  if (req.user.role !== "customer") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only customers are permitted to book appointments",
      },
    });
    return;
  }

  try {
    const validatedInput = createBookingSchema.parse(req.body);
    const booking = await createCustomerBooking(req.user.id, validatedInput);

    res.status(201).json({
      booking,
    });
  } catch (err) {
    if (err instanceof BusinessNotFoundError) {
      res.status(404).json({
        error: { code: "BUSINESS_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof BusinessSuspendedError) {
      res.status(403).json({
        error: { code: "BUSINESS_SUSPENDED", message: err.message },
      });
      return;
    }
    if (err instanceof ServiceNotFoundError) {
      res.status(404).json({
        error: { code: "SERVICE_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof ServiceInactiveError) {
      res.status(400).json({
        error: { code: "SERVICE_INACTIVE", message: err.message },
      });
      return;
    }
    if (err instanceof DateOutOfWindowError) {
      res.status(400).json({
        error: { code: "DATE_OUT_OF_WINDOW", message: err.message },
      });
      return;
    }
    if (err instanceof InvalidBookingTimeError) {
      res.status(400).json({
        error: { code: "INVALID_BOOKING_TIME", message: err.message },
      });
      return;
    }
    if (err instanceof SlotConflictError) {
      res.status(409).json({
        error: { code: "SLOT_UNAVAILABLE", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/bookings/me
 * List all bookings for the authenticated customer.
 */
export async function handleListMyBookings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const validatedQuery = listBookingsQuerySchema.parse(req.query);
    const bookings = await listCustomerBookings(
      req.user.id,
      validatedQuery.status
    );

    res.status(200).json({
      bookings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle GET /api/v1/bookings/:bookingId
 * Retrieve a single booking for the authenticated customer.
 */
export async function handleGetMyBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const bookingId = Array.isArray(req.params.bookingId)
      ? req.params.bookingId[0]
      : req.params.bookingId;

    const booking = await getCustomerBookingById(req.user.id, bookingId);

    if (!booking) {
      res.status(404).json({
        error: { code: "BOOKING_NOT_FOUND", message: "Booking not found" },
      });
      return;
    }

    res.status(200).json({
      booking,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle POST /api/v1/bookings/:bookingId/cancel and PATCH /api/v1/bookings/:bookingId/cancel
 * Customer cancels their own booking subject to the 2-hour cancellation cutoff.
 */
export async function handleCancelMyBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  try {
    const bookingId = Array.isArray(req.params.bookingId)
      ? req.params.bookingId[0]
      : req.params.bookingId;

    const booking = await cancelCustomerBooking(req.user.id, bookingId);

    res.status(200).json({
      booking,
      message: "Booking cancelled successfully",
    });
  } catch (err) {
    if (err instanceof BookingNotFoundError) {
      res.status(404).json({
        error: { code: "BOOKING_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof BookingAlreadyCancelledError) {
      res.status(400).json({
        error: { code: "BOOKING_ALREADY_CANCELLED", message: err.message },
      });
      return;
    }
    if (err instanceof CancellationDeadlinePassedError) {
      res.status(400).json({
        error: { code: "CANCELLATION_DEADLINE_PASSED", message: err.message },
      });
      return;
    }
    next(err);
  }
}

/**
 * Handle GET /api/v1/businesses/me/bookings
 * Authenticated business owner lists bookings for their business.
 */
export async function handleListOwnerBookings(
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
    const validatedQuery = listBookingsQuerySchema.parse(req.query);
    const bookings = await listOwnerBookings(
      req.business.id,
      validatedQuery.status,
      validatedQuery.date
    );

    res.status(200).json({
      bookings,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle POST /api/v1/businesses/me/bookings/:bookingId/cancel
 * Authenticated business owner cancels a booking for their business at any time.
 */
export async function handleCancelOwnerBooking(
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
    const bookingId = Array.isArray(req.params.bookingId)
      ? req.params.bookingId[0]
      : req.params.bookingId;

    const booking = await cancelOwnerBooking(
      req.business.id,
      bookingId,
      req.user?.id
    );

    res.status(200).json({
      booking,
      message: "Booking cancelled successfully",
    });
  } catch (err) {
    if (err instanceof BookingNotFoundError) {
      res.status(404).json({
        error: { code: "BOOKING_NOT_FOUND", message: err.message },
      });
      return;
    }
    if (err instanceof BookingAlreadyCancelledError) {
      res.status(400).json({
        error: { code: "BOOKING_ALREADY_CANCELLED", message: err.message },
      });
      return;
    }
    next(err);
  }
}
