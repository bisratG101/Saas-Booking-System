import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePlatformAdmin } from "../../middleware/requirePlatformAdmin";
import {
  handleGetStats,
  handleListBusinesses,
  handleGetBusiness,
  handleSuspendBusiness,
  handleReactivateBusiness,
  handleUpdateBusinessStatus,
  handleUpdateSubscription,
  handleListActivityLogs,
} from "./adminController";

const router = Router();

// Strictly protect all administrative endpoints:
// Requires valid authentication AND platform_admin role.
router.use(authenticate, requirePlatformAdmin);

// Platform Overview Statistics
router.get("/stats", handleGetStats);

// Business Management & Inspection
router.get("/businesses", handleListBusinesses);
router.get("/businesses/:businessId", handleGetBusiness);

// Business Suspension & Activation
router.post("/businesses/:businessId/suspend", handleSuspendBusiness);
router.post("/businesses/:businessId/reactivate", handleReactivateBusiness);
router.patch("/businesses/:businessId/status", handleUpdateBusinessStatus);

// Subscription Oversight
router.patch("/businesses/:businessId/subscription", handleUpdateSubscription);

// Platform Audit Logs
router.get("/activity-logs", handleListActivityLogs);

export { router as adminRoutes };
