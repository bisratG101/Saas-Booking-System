import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireBusinessOwner } from "../../middleware/requireBusinessOwner";
import {
  handleCreateBusiness,
  handleGetMyBusiness,
  handleUpdateMyBusiness,
  handleListPublicBusinesses,
} from "./businessController";
import {
  handleCreateService,
  handleListMyServices,
  handleGetMyService,
  handleUpdateMyService,
  handleDeactivateMyService,
  handleListPublicBusinessServices,
} from "./servicesController";
import {
  handleGetWeeklyHours,
  handleSetWeeklyHours,
} from "./hoursController";
import {
  handleGetAvailability,
  handleListOwnerBookings,
  handleCancelOwnerBooking,
} from "../bookings/bookingController";
import {
  handleGetMySubscription,
  handleCancelMySubscription,
} from "../subscriptions/subscriptionController";

const router = Router();

// ----------------------------------------------------------------------------
// Business Profile Routes
// ----------------------------------------------------------------------------
// Public list of active businesses (suspended businesses excluded)
router.get("/", handleListPublicBusinesses);

// Authenticated user creates a business
router.post("/", authenticate, handleCreateBusiness);

// Authenticated owner retrieves their own business
router.get("/me", authenticate, handleGetMyBusiness);

// Authenticated owner updates their own business
router.patch("/me", authenticate, requireBusinessOwner, handleUpdateMyBusiness);

// ----------------------------------------------------------------------------
// Owner Subscription Routes (Strictly scoped to authenticated owner's business)
// ----------------------------------------------------------------------------
router.get("/me/subscription", authenticate, requireBusinessOwner, handleGetMySubscription);
router.post("/me/subscription/cancel", authenticate, requireBusinessOwner, handleCancelMySubscription);

// ----------------------------------------------------------------------------
// Working Hours Routes (Strictly scoped to the authenticated owner's business)
// ----------------------------------------------------------------------------
router.get("/me/hours", authenticate, requireBusinessOwner, handleGetWeeklyHours);
router.put("/me/hours", authenticate, requireBusinessOwner, handleSetWeeklyHours);

// ----------------------------------------------------------------------------
// Services CRUD Routes (Strictly scoped to the authenticated owner's business)
// ----------------------------------------------------------------------------
router.post("/me/services", authenticate, requireBusinessOwner, handleCreateService);
router.get("/me/services", authenticate, requireBusinessOwner, handleListMyServices);
router.get("/me/services/:serviceId", authenticate, requireBusinessOwner, handleGetMyService);
router.patch("/me/services/:serviceId", authenticate, requireBusinessOwner, handleUpdateMyService);
router.delete("/me/services/:serviceId", authenticate, requireBusinessOwner, handleDeactivateMyService);
router.patch("/me/services/:serviceId/deactivate", authenticate, requireBusinessOwner, handleDeactivateMyService);

// ----------------------------------------------------------------------------
// Owner Bookings Routes (Strictly scoped to the authenticated owner's business)
// ----------------------------------------------------------------------------
router.get("/me/bookings", authenticate, requireBusinessOwner, handleListOwnerBookings);
router.post("/me/bookings/:bookingId/cancel", authenticate, requireBusinessOwner, handleCancelOwnerBooking);
router.patch("/me/bookings/:bookingId/cancel", authenticate, requireBusinessOwner, handleCancelOwnerBooking);

// ----------------------------------------------------------------------------
// Public Business Services & Availability Routes
// ----------------------------------------------------------------------------
router.get("/:businessId/services", handleListPublicBusinessServices);
router.get("/:businessId/services/:serviceId/availability", handleGetAvailability);

export { router as businessRoutes };
