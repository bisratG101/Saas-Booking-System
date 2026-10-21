import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  handleCreateBooking,
  handleListMyBookings,
  handleGetMyBooking,
  handleCancelMyBooking,
} from "./bookingController";

const router = Router();

// ----------------------------------------------------------------------------
// Customer Booking Routes (Mounted at /api/v1/bookings)
// ----------------------------------------------------------------------------

// Authenticated customer creates a new appointment booking
router.post("/", authenticate, handleCreateBooking);

// Authenticated customer lists their own bookings
router.get("/me", authenticate, handleListMyBookings);

// Authenticated customer retrieves a single booking
router.get("/:bookingId", authenticate, handleGetMyBooking);

// Authenticated customer cancels a booking (subject to >= 2h cancellation window)
router.post("/:bookingId/cancel", authenticate, handleCancelMyBooking);
router.patch("/:bookingId/cancel", authenticate, handleCancelMyBooking);

export { router as bookingRoutes };
