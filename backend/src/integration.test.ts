import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "./app";
import * as dbModule from "./db";
import { signToken } from "./modules/auth/jwt";

describe("End-to-End Integration, Regression, and Security Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test identities
  const customerAId = "11111111-aaaa-1111-aaaa-111111111111";
  const customerBId = "22222222-bbbb-2222-bbbb-222222222222";
  const ownerAId = "33333333-aaaa-3333-aaaa-333333333333";
  const ownerBId = "44444444-bbbb-4444-bbbb-444444444444";
  const adminId = "99999999-ffff-9999-ffff-999999999999";

  const businessAId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const businessBId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const serviceAId = "55555555-aaaa-5555-aaaa-555555555555";
  const bookingAId = "66666666-aaaa-6666-aaaa-666666666666";

  const customerAToken = signToken({
    sub: customerAId,
    role: "customer",
    email: "customera@example.com",
  });

  const customerBToken = signToken({
    sub: customerBId,
    role: "customer",
    email: "customerb@example.com",
  });

  const ownerAToken = signToken({
    sub: ownerAId,
    role: "business_owner",
    email: "ownera@example.com",
  });

  const ownerBToken = signToken({
    sub: ownerBId,
    role: "business_owner",
    email: "ownerb@example.com",
  });

  const adminToken = signToken({
    sub: adminId,
    role: "platform_admin",
    email: "admin@example.com",
  });

  const businessARow = {
    id: businessAId,
    owner_id: ownerAId,
    name: "Alpha Clinic",
    timezone: "Africa/Addis_Ababa",
    status: "active",
  };

  const businessBRow = {
    id: businessBId,
    owner_id: ownerBId,
    name: "Beta Dental",
    timezone: "UTC",
    status: "active",
  };

  // ==========================================================================
  // SECTION 1: Customer Workflow & Multi-Tenant Booking Isolation
  // ==========================================================================
  describe("Customer Workflow & Tenant Isolation", () => {
    it("should prevent Customer B from viewing Customer A's booking (404 Not Found)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // Query looks for booking WHERE id = $1 AND customer_id = $2
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get(`/api/v1/bookings/${bookingAId}`)
        .set("Authorization", `Bearer ${customerBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BOOKING_NOT_FOUND");
    });

    it("should prevent Customer B from cancelling Customer A's booking (404 Not Found)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${bookingAId}/cancel`)
        .set("Authorization", `Bearer ${customerBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BOOKING_NOT_FOUND");
    });

    it("should reject customer cancellation within 2 hours of appointment start time (400 CANCELLATION_DEADLINE_PASSED)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 90 minutes in future (< 2 hours)
      const soonStartTime = new Date(Date.now() + 90 * 60 * 1000);

      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: bookingAId,
            business_id: businessAId,
            customer_id: customerAId,
            service_id: serviceAId,
            start_time: soonStartTime,
            status: "confirmed",
            created_at: new Date(),
            updated_at: new Date(),
            cancelled_at: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${bookingAId}/cancel`)
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "CANCELLATION_DEADLINE_PASSED");
    });

    it("should reject booking creation on a suspended business (403 BUSINESS_SUSPENDED)", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const querySpy = vi.spyOn(dbModule, "query");

      // Business lookup returns suspended
      querySpy.mockResolvedValueOnce({
        rows: [{ id: businessAId, timezone: "Africa/Addis_Ababa", status: "suspended" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          business_id: businessAId,
          service_id: serviceAId,
          start_time: tomorrow.toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "BUSINESS_SUSPENDED");
    });

    it("should reject booking creation on an inactive service (400 SERVICE_INACTIVE)", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const querySpy = vi.spyOn(dbModule, "query");

      // 1. Business active
      querySpy.mockResolvedValueOnce({
        rows: [{ id: businessAId, timezone: "Africa/Addis_Ababa", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Service inactive
      querySpy.mockResolvedValueOnce({
        rows: [{ id: serviceAId, is_active: false }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          business_id: businessAId,
          service_id: serviceAId,
          start_time: tomorrow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "SERVICE_INACTIVE");
    });

    it("should reject booking creation outside the rolling 30-day window (400 INVALID_BOOKING_TIME)", async () => {
      // 45 days in future (> 30 days)
      const distantFuture = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          business_id: businessAId,
          service_id: serviceAId,
          start_time: distantFuture.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_BOOKING_TIME");
    });
  });

  // ==========================================================================
  // SECTION 2: Business-Owner Scope & Security Controls
  // ==========================================================================
  describe("Business-Owner Scope & Security Controls", () => {
    it("should ignore client-supplied business ID and strictly bind to authenticated owner's business", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner query resolves Business A for Owner A
      querySpy.mockResolvedValueOnce({
        rows: [businessARow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Services list query strictly uses Business A ID ($1 = businessAId)
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: serviceAId,
            business_id: businessAId,
            name: "Consultation",
            description: null,
            duration_minutes: 30,
            price: "100.00",
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      // Client attempts to pass business_id=businessBId in query string
      const res = await request(app)
        .get(`/api/v1/businesses/me/services?business_id=${businessBId}`)
        .set("Authorization", `Bearer ${ownerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.services[0].businessId).toBe(businessAId);
    });

    it("should prevent Owner B from modifying or deactivating Owner A's service (404 Not Found)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner resolves Business B for Owner B
      querySpy.mockResolvedValueOnce({
        rows: [businessBRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Service lookup WHERE id = serviceAId AND business_id = businessBId returns empty
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .delete(`/api/v1/businesses/me/services/${serviceAId}`)
        .set("Authorization", `Bearer ${ownerBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "SERVICE_NOT_FOUND");
    });

    it("should permit business owner to cancel an appointment even within 2 hours of start time", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      const soonStartTime = new Date(Date.now() + 45 * 60 * 1000); // 45 mins in future

      // 1. requireBusinessOwner
      querySpy.mockResolvedValueOnce({
        rows: [businessARow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Select booking
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: bookingAId,
            business_id: businessAId,
            customer_id: customerAId,
            service_id: serviceAId,
            start_time: soonStartTime,
            status: "confirmed",
            created_at: new Date(),
            updated_at: new Date(),
            cancelled_at: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. Update booking
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: bookingAId,
            business_id: businessAId,
            customer_id: customerAId,
            service_id: serviceAId,
            start_time: soonStartTime,
            status: "cancelled",
            created_at: new Date(),
            updated_at: new Date(),
            cancelled_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "UPDATE",
        oid: 0,
        fields: [],
      });
      // 4. Activity log
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/businesses/me/bookings/${bookingAId}/cancel`)
        .set("Authorization", `Bearer ${ownerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe("cancelled");
      expect(res.body.message).toBe("Booking cancelled successfully");
    });

    it("should reject working hours with invalid ranges (close_time <= open_time)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [businessARow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${ownerAToken}`)
        .send({
          hours: [
            { day_of_week: 1, is_closed: false, open_time: "17:00", close_time: "09:00" }, // Invalid!
            { day_of_week: 2, is_closed: false, open_time: "09:00", close_time: "17:00" },
            { day_of_week: 3, is_closed: false, open_time: "09:00", close_time: "17:00" },
            { day_of_week: 4, is_closed: false, open_time: "09:00", close_time: "17:00" },
            { day_of_week: 5, is_closed: false, open_time: "09:00", close_time: "17:00" },
            { day_of_week: 6, is_closed: true },
            { day_of_week: 7, is_closed: true },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });
  });

  // ==========================================================================
  // SECTION 3: Platform Admin Access Control & Privileges
  // ==========================================================================
  describe("Platform Admin Access Control & Privileges", () => {
    it("should reject customer access to admin stats with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/stats")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should reject business owner access to admin business management with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${ownerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should reject unauthenticated access to admin activity logs with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/admin/activity-logs");

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should allow platform administrator to access admin stats", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. Business counts
      querySpy.mockResolvedValueOnce({
        rows: [{ total: "5", active: "4", suspended: "1" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Subscription counts
      querySpy.mockResolvedValueOnce({
        rows: [
          { status: "active", count: "4" },
          { status: "suspended", count: "1" },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. Booking counts
      querySpy.mockResolvedValueOnce({
        rows: [{ total: "25", confirmed: "20", cancelled: "5" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 4. User counts
      querySpy.mockResolvedValueOnce({
        rows: [
          { role: "customer", count: "15" },
          { role: "business_owner", count: "5" },
          { role: "platform_admin", count: "2" },
        ],
        rowCount: 3,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalBusinesses).toBe(5);
      expect(res.body.activeBusinesses).toBe(4);
      expect(res.body.suspendedBusinesses).toBe(1);
      expect(res.body.totalBookings).toBe(25);
      expect(res.body.totalUsers).toBe(22);
    });
  });

  // ==========================================================================
  // SECTION 4: Input Validation, Malformed Payloads & Token Security
  // ==========================================================================
  describe("Input Validation, Malformed Payloads & Token Security", () => {
    it("should reject malformed non-UUID identifiers in booking payload with 400 Validation Error", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          business_id: "not-a-valid-uuid",
          service_id: "not-a-valid-uuid",
          start_time: "2026-10-25T10:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should reject malformed date formats in availability query with 400", async () => {
      const res = await request(app)
        .get(`/api/v1/businesses/${businessAId}/services/${serviceAId}/availability?date=not-a-date`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should reject tampered or corrupted JWT tokens with 401 Unauthorized", async () => {
      const tamperedToken = `${customerAToken}tampered`;

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "INVALID_TOKEN");
    });

    it("should reject malformed JSON request bodies with 400 and INVALID_JSON code", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("Content-Type", "application/json")
        .send("{ broken json: ");

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_JSON");
      expect(res.body.error.message).toContain("Malformed JSON");
    });
  });
});
