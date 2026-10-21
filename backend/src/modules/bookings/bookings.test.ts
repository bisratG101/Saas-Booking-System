import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../app";
import * as dbModule from "../../db";
import { signToken } from "../auth/jwt";

describe("Availability and Booking Engine Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomerId = "11111111-1111-1111-1111-111111111111";
  const mockOtherCustomerId = "99999999-9999-9999-9999-999999999999";
  const mockOwnerId = "22222222-2222-2222-2222-222222222222";
  const mockOtherOwnerId = "33333333-3333-3333-3333-333333333333";

  const mockCustomerToken = signToken({
    sub: mockCustomerId,
    role: "customer",
    email: "customer@example.com",
  });

  const mockOtherCustomerToken = signToken({
    sub: mockOtherCustomerId,
    role: "customer",
    email: "othercustomer@example.com",
  });

  const mockOwnerToken = signToken({
    sub: mockOwnerId,
    role: "business_owner",
    email: "owner@example.com",
  });

  const mockOtherOwnerToken = signToken({
    sub: mockOtherOwnerId,
    role: "business_owner",
    email: "otherowner@example.com",
  });

  const mockBusinessId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const mockOtherBusinessId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const mockServiceId = "55555555-5555-5555-5555-555555555555";
  const mockBookingId = "00000000-0000-0000-0000-000000000001";

  // Helper for mock business lookup for requireBusinessOwner middleware
  const mockOwnerBusinessDbRow = {
    id: mockBusinessId,
    owner_id: mockOwnerId,
    name: "Addis Premier Clinic",
    timezone: "Africa/Addis_Ababa",
    status: "active",
  };

  // --------------------------------------------------------------------------
  // STAGE 2: Public Availability Calculation
  // --------------------------------------------------------------------------
  describe("GET /api/v1/businesses/:businessId/services/:serviceId/availability", () => {
    it("should reject missing or malformed date query with 400", async () => {
      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability`
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should reject date outside the rolling 30-day window with 400", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "Africa/Addis_Ababa", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true, duration_minutes: 30 }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      // Date in the distant future (e.g. 60 days ahead)
      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=2028-01-01`
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "DATE_OUT_OF_WINDOW");
    });

    it("should return 404 if business does not exist", async () => {
      // Choose tomorrow date
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BUSINESS_NOT_FOUND");
    });

    it("should return 403 if business is suspended", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "Africa/Addis_Ababa", status: "suspended" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "BUSINESS_SUSPENDED");
    });

    it("should return 404 if service does not belong to business", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const querySpy = vi.spyOn(dbModule, "query");
      // Business exists
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "Africa/Addis_Ababa", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // Service not found
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "SERVICE_NOT_FOUND");
    });

    it("should return 400 if service is inactive", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "Africa/Addis_Ababa", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: false, duration_minutes: 30 }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "SERVICE_INACTIVE");
    });

    it("should return empty slots array when business is closed on the requested day", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "UTC", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true, duration_minutes: 30 }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ open_time: null, close_time: null, is_closed: true }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        businessId: mockBusinessId,
        serviceId: mockServiceId,
        date: dateStr,
        slots: [],
      });
    });

    it("should calculate 30-min slots correctly and filter out existing confirmed bookings & blocks", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const querySpy = vi.spyOn(dbModule, "query");
      // 1. Business
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "UTC", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Service
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true, duration_minutes: 30 }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. Business hours (09:00 - 10:30 UTC -> 3 slots: 09:00, 09:30, 10:00)
      querySpy.mockResolvedValueOnce({
        rows: [{ open_time: "09:00", close_time: "10:30", is_closed: false }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 4. Confirmed bookings (slot at 09:30 is booked)
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            start_time: new Date(`${dateStr}T09:30:00.000Z`),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 5. Availability blocks (slot at 10:00 overlaps maintenance block)
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: "block-1",
            start_time: new Date(`${dateStr}T10:00:00.000Z`),
            end_time: new Date(`${dateStr}T10:30:00.000Z`),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(
        `/api/v1/businesses/${mockBusinessId}/services/${mockServiceId}/availability?date=${dateStr}`
      );

      expect(res.status).toBe(200);
      expect(res.body.slots).toHaveLength(1);
      // Only slot 1 (09:00 - 09:30) is available; 09:30 is booked and 10:00 is blocked
      expect(res.body.slots[0]).toMatchObject({
        startTime: `${dateStr}T09:00:00.000Z`,
        endTime: `${dateStr}T09:30:00.000Z`,
        localStartTime: "09:00",
        localEndTime: "09:30",
      });
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 3 & 4: Booking Creation and Concurrency
  // --------------------------------------------------------------------------
  describe("POST /api/v1/bookings", () => {
    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .send({
          business_id: mockBusinessId,
          service_id: mockServiceId,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject non-customer roles with 403", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          business_id: mockBusinessId,
          service_id: mockServiceId,
          start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should reject invalid body with 400 validation error", async () => {
      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          business_id: "not-a-uuid",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    it("should reject start_time not aligned to 30-minute boundary with 400", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const unalignedTime = `${dateStr}T10:15:00.000Z`;

      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "UTC", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          business_id: mockBusinessId,
          service_id: mockServiceId,
          start_time: unalignedTime,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_BOOKING_TIME");
    });

    it("should successfully create booking when slot is valid and available", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const validTime = `${dateStr}T10:00:00.000Z`;

      const querySpy = vi.spyOn(dbModule, "query");
      // 1. Business
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "UTC", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Service
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. Business hours
      querySpy.mockResolvedValueOnce({
        rows: [{ open_time: "09:00", close_time: "17:00", is_closed: false }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 4. Availability blocks check
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 5. Booking insertion
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: new Date(validTime),
            status: "confirmed",
            created_at: new Date(),
            updated_at: new Date(),
            cancelled_at: null,
          },
        ],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });
      // 6. Activity log
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          business_id: mockBusinessId,
          service_id: mockServiceId,
          start_time: validTime,
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toMatchObject({
        id: mockBookingId,
        businessId: mockBusinessId,
        customerId: mockCustomerId,
        serviceId: mockServiceId,
        status: "confirmed",
      });
    });

    it("should trap PostgreSQL unique partial index violation (23505) and return 409 Conflict", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const validTime = `${dateStr}T10:00:00.000Z`;

      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, timezone: "UTC", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ id: mockServiceId, is_active: true }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [{ open_time: "09:00", close_time: "17:00", is_closed: false }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // Simultaneous double booking throws unique violation
      const pgUniqueError: any = new Error("duplicate key value violates unique constraint 'unique_active_booking_slot'");
      pgUniqueError.code = "23505";
      querySpy.mockRejectedValueOnce(pgUniqueError);

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          business_id: mockBusinessId,
          service_id: mockServiceId,
          start_time: validTime,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty("code", "SLOT_UNAVAILABLE");
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 5: Customer Booking Retrieval and 2-Hour Cancellation
  // --------------------------------------------------------------------------
  describe("Customer Bookings Management (/api/v1/bookings/me & /api/v1/bookings/:id)", () => {
    it("should list bookings for the authenticated customer", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: new Date("2026-10-25T10:00:00.000Z"),
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
        .get("/api/v1/bookings/me")
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].id).toBe(mockBookingId);
    });

    it("should retrieve a single booking by ID if owned by customer", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: new Date("2026-10-25T10:00:00.000Z"),
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
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.booking.id).toBe(mockBookingId);
    });

    it("should return 404 when customer tries to access another customer's booking", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get(`/api/v1/bookings/${mockBookingId}`)
        .set("Authorization", `Bearer ${mockOtherCustomerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BOOKING_NOT_FOUND");
    });

    it("should reject customer cancellation if appointment is less than 2 hours away", async () => {
      // 1 hour in the future (< 2 hours)
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: oneHourFromNow,
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
        .post(`/api/v1/bookings/${mockBookingId}/cancel`)
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "CANCELLATION_DEADLINE_PASSED");
    });

    it("should allow customer cancellation if appointment is >= 2 hours away", async () => {
      // 24 hours in the future
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const querySpy = vi.spyOn(dbModule, "query");
      // 1. Check existing booking
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: tomorrow,
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
      // 2. Update booking to cancelled
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: tomorrow,
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
      // 3. Activity log
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/bookings/${mockBookingId}/cancel`)
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe("cancelled");
      expect(res.body.message).toBe("Booking cancelled successfully");
    });
  });

  // --------------------------------------------------------------------------
  // STAGE 6: Business Owner Booking Management
  // --------------------------------------------------------------------------
  describe("Owner Bookings Management (/api/v1/businesses/me/bookings)", () => {
    it("should list all bookings for the authenticated owner's business", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner lookup
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessDbRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. listOwnerBookings lookup
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: new Date("2026-10-25T10:00:00.000Z"),
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
        .get("/api/v1/businesses/me/bookings")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].businessId).toBe(mockBusinessId);
    });

    it("should allow business owner to cancel an appointment at any time (even < 2 hours)", async () => {
      // 30 minutes in the future (< 2 hours, which customer cannot cancel)
      const soon = new Date(Date.now() + 30 * 60 * 1000);

      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessDbRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. cancelOwnerBooking select
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: soon,
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
      // 3. cancelOwnerBooking update
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBookingId,
            business_id: mockBusinessId,
            customer_id: mockCustomerId,
            service_id: mockServiceId,
            start_time: soon,
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
        .post(`/api/v1/businesses/me/bookings/${mockBookingId}/cancel`)
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe("cancelled");
      expect(res.body.message).toBe("Booking cancelled successfully");
    });

    it("should prevent cross-tenant owner cancellation (404 when booking belongs to another business)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner (returns OtherOwner's business)
      querySpy.mockResolvedValueOnce({
        rows: [{
          id: mockOtherBusinessId,
          owner_id: mockOtherOwnerId,
          name: "Other Business",
          timezone: "UTC",
          status: "active",
        }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Check booking for mockOtherBusinessId (not found)
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/businesses/me/bookings/${mockBookingId}/cancel`)
        .set("Authorization", `Bearer ${mockOtherOwnerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BOOKING_NOT_FOUND");
    });
  });
});
