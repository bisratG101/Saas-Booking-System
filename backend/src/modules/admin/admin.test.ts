import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../app";
import * as dbModule from "../../db";
import { signToken } from "../auth/jwt";

describe("Subscription Management & Platform Administration Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminId = "99999999-9999-9999-9999-999999999999";
  const mockOwnerId = "22222222-2222-2222-2222-222222222222";
  const mockOtherOwnerId = "33333333-3333-3333-3333-333333333333";
  const mockCustomerId = "11111111-1111-1111-1111-111111111111";

  const mockAdminToken = signToken({
    sub: mockAdminId,
    role: "platform_admin",
    email: "admin@platform.example.com",
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

  const mockCustomerToken = signToken({
    sub: mockCustomerId,
    role: "customer",
    email: "customer@example.com",
  });

  const mockBusinessId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const mockOtherBusinessId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  const mockOwnerBusinessRow = {
    id: mockBusinessId,
    owner_id: mockOwnerId,
    name: "Addis Premier Clinic",
    timezone: "Africa/Addis_Ababa",
    status: "active",
  };

  const mockOtherOwnerBusinessRow = {
    id: mockOtherBusinessId,
    owner_id: mockOtherOwnerId,
    name: "Other Clinic",
    timezone: "UTC",
    status: "active",
  };

  const mockSubscriptionRow = {
    id: "ssssssss-0000-0000-0000-000000000001",
    business_id: mockBusinessId,
    plan_name: "starter",
    status: "active",
    started_at: new Date("2026-01-01T00:00:00.000Z"),
    current_period_end: new Date("2026-02-01T00:00:00.000Z"),
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  };

  // ==========================================================================
  // 1. Subscription Management (/api/v1/businesses/me/subscription)
  // ==========================================================================
  describe("Owner Subscription Management", () => {
    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/v1/businesses/me/subscription");
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject customer access to business subscription with 403", async () => {
      // requireBusinessOwner rejects customers who have no business
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/businesses/me/subscription")
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should allow business owner to retrieve their own subscription", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. getSubscriptionByBusinessId
      querySpy.mockResolvedValueOnce({
        rows: [mockSubscriptionRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/businesses/me/subscription")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription).toMatchObject({
        businessId: mockBusinessId,
        planName: "starter",
        status: "active",
      });
    });

    it("should strictly enforce tenant boundary (owner cannot view other owner's subscription)", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // requireBusinessOwner verifies the authenticated other owner owns mockOtherBusinessId
      querySpy.mockResolvedValueOnce({
        rows: [mockOtherOwnerBusinessRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // queries mockOtherBusinessId, NOT mockBusinessId
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            ...mockSubscriptionRow,
            id: "ssssssss-0000-0000-0000-000000000002",
            business_id: mockOtherBusinessId,
            plan_name: "starter",
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/businesses/me/subscription")
        .set("Authorization", `Bearer ${mockOtherOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.businessId).toBe(mockOtherBusinessId);
      expect(res.body.subscription.businessId).not.toBe(mockBusinessId);
    });

    it("should allow an owner to cancel their active subscription", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. get current subscription
      querySpy.mockResolvedValueOnce({
        rows: [mockSubscriptionRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. update subscription to cancelled
      querySpy.mockResolvedValueOnce({
        rows: [{ ...mockSubscriptionRow, status: "cancelled" }],
        rowCount: 1,
        command: "UPDATE",
        oid: 0,
        fields: [],
      });
      // 4. activity log
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/businesses/me/subscription/cancel")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe("cancelled");
      expect(res.body.message).toBe("Subscription cancelled successfully");
    });

    it("should reject owner cancellation if subscription is already cancelled with 400", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. requireBusinessOwner
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. get current subscription (already cancelled)
      querySpy.mockResolvedValueOnce({
        rows: [{ ...mockSubscriptionRow, status: "cancelled" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post("/api/v1/businesses/me/subscription/cancel")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_SUBSCRIPTION_STATUS");
    });
  });

  // ==========================================================================
  // 2. Platform Administration Authorization & Guardrails
  // ==========================================================================
  describe("Admin Route Protection", () => {
    it("should reject unauthenticated requests to admin endpoints with 401", async () => {
      const res = await request(app).get("/api/v1/admin/stats");
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject customer access to admin endpoints with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/stats")
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });

    it("should reject business owner access to admin endpoints with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty("code", "FORBIDDEN");
    });
  });

  // ==========================================================================
  // 3. Platform Administration Operations
  // ==========================================================================
  describe("Admin Statistics & Business Management", () => {
    it("should return aggregate platform statistics without exposing customer PII", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // 1. Businesses counts
      querySpy.mockResolvedValueOnce({
        rows: [{ total: "10", active: "8", suspended: "2" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 2. Subscriptions by status
      querySpy.mockResolvedValueOnce({
        rows: [
          { status: "active", count: "7" },
          { status: "past_due", count: "1" },
          { status: "cancelled", count: "1" },
          { status: "suspended", count: "1" },
        ],
        rowCount: 4,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 3. Bookings counts
      querySpy.mockResolvedValueOnce({
        rows: [{ total: "50", confirmed: "45", cancelled: "5" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // 4. Users by role
      querySpy.mockResolvedValueOnce({
        rows: [
          { role: "platform_admin", count: "1" },
          { role: "business_owner", count: "10" },
          { role: "customer", count: "80" },
        ],
        rowCount: 3,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/admin/stats")
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalBusinesses: 10,
        activeBusinesses: 8,
        suspendedBusinesses: 2,
        subscriptionsByStatus: {
          active: 7,
          past_due: 1,
          cancelled: 1,
          suspended: 1,
        },
        totalBookings: 50,
        confirmedBookings: 45,
        cancelledBookings: 5,
        totalUsers: 91,
      });
      // Ensure no passwords or PII lists returned
      expect(res.body).not.toHaveProperty("users");
      expect(res.body).not.toHaveProperty("customers");
    });

    it("should list businesses with pagination and without exposing sensitive user data", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      // Count query
      querySpy.mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      // List query
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBusinessId,
            name: "Addis Premier Clinic",
            timezone: "Africa/Addis_Ababa",
            status: "active",
            owner_id: mockOwnerId,
            owner_name: "Dr. Owner",
            owner_email: "owner@example.com",
            sub_id: mockSubscriptionRow.id,
            sub_plan: "starter",
            sub_status: "active",
            sub_started_at: mockSubscriptionRow.started_at,
            sub_current_period_end: mockSubscriptionRow.current_period_end,
            sub_created_at: mockSubscriptionRow.created_at,
            sub_updated_at: mockSubscriptionRow.updated_at,
            services_count: "3",
            bookings_count: "12",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/admin/businesses?page=1&limit=10")
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.businesses).toHaveLength(1);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      // Security check: no password hashes exposed
      expect(res.body.businesses[0]).not.toHaveProperty("password_hash");
      expect(res.body.businesses[0]).not.toHaveProperty("password");
    });

    it("should retrieve a single business by ID with full details", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: mockBusinessId,
            name: "Addis Premier Clinic",
            timezone: "Africa/Addis_Ababa",
            status: "active",
            owner_id: mockOwnerId,
            owner_name: "Dr. Owner",
            owner_email: "owner@example.com",
            sub_id: mockSubscriptionRow.id,
            sub_plan: "starter",
            sub_status: "active",
            sub_started_at: mockSubscriptionRow.started_at,
            sub_current_period_end: mockSubscriptionRow.current_period_end,
            sub_created_at: mockSubscriptionRow.created_at,
            sub_updated_at: mockSubscriptionRow.updated_at,
            services_count: "2",
            bookings_count: "5",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get(`/api/v1/admin/businesses/${mockBusinessId}`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.business.id).toBe(mockBusinessId);
      expect(res.body.business.servicesCount).toBe(2);
    });

    it("should return 404 when admin queries a non-existent business", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get(`/api/v1/admin/businesses/${mockBusinessId}`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty("code", "BUSINESS_NOT_FOUND");
    });
  });

  // ==========================================================================
  // 4. Business Suspension & Reactivation
  // ==========================================================================
  describe("Admin Business Suspension & Reactivation", () => {
    it("should allow admin to suspend an active business", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. SELECT business FOR UPDATE
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, status: "active" }],
      });
      // 3. UPDATE platform.businesses
      mockClient.query.mockResolvedValueOnce({});
      // 4. UPDATE platform.subscriptions
      mockClient.query.mockResolvedValueOnce({});
      // 5. INSERT platform.activity_logs
      mockClient.query.mockResolvedValueOnce({});
      // 6. COMMIT
      mockClient.query.mockResolvedValueOnce({});

      // Mock getBusinessById query after commit
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [
          {
            id: mockBusinessId,
            name: "Addis Premier Clinic",
            timezone: "Africa/Addis_Ababa",
            status: "suspended",
            owner_id: mockOwnerId,
            owner_name: "Dr. Owner",
            owner_email: "owner@example.com",
            sub_id: mockSubscriptionRow.id,
            sub_plan: "starter",
            sub_status: "suspended",
            sub_started_at: mockSubscriptionRow.started_at,
            sub_current_period_end: null,
            sub_created_at: mockSubscriptionRow.created_at,
            sub_updated_at: new Date(),
            services_count: "2",
            bookings_count: "5",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/admin/businesses/${mockBusinessId}/suspend`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.business.status).toBe("suspended");
      expect(res.body.message).toBe("Business suspended successfully");
    });

    it("should reject suspending an already suspended business with 400", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, status: "suspended" }], // already suspended
      });
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .post(`/api/v1/admin/businesses/${mockBusinessId}/suspend`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_STATUS_TRANSITION");
    });

    it("should allow admin to reactivate a suspended business", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, status: "suspended" }],
      });
      mockClient.query.mockResolvedValueOnce({}); // UPDATE businesses
      mockClient.query.mockResolvedValueOnce({}); // UPDATE subscriptions
      mockClient.query.mockResolvedValueOnce({}); // INSERT activity_logs
      mockClient.query.mockResolvedValueOnce({}); // COMMIT

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [
          {
            id: mockBusinessId,
            name: "Addis Premier Clinic",
            timezone: "Africa/Addis_Ababa",
            status: "active",
            owner_id: mockOwnerId,
            owner_name: "Dr. Owner",
            owner_email: "owner@example.com",
            sub_id: mockSubscriptionRow.id,
            sub_plan: "starter",
            sub_status: "active",
            sub_started_at: mockSubscriptionRow.started_at,
            sub_current_period_end: null,
            sub_created_at: mockSubscriptionRow.created_at,
            sub_updated_at: new Date(),
            services_count: "2",
            bookings_count: "5",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post(`/api/v1/admin/businesses/${mockBusinessId}/reactivate`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.business.status).toBe("active");
      expect(res.body.message).toBe("Business reactivated successfully");
    });

    it("should reject reactivating an already active business with 400", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, status: "active" }],
      });
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .post(`/api/v1/admin/businesses/${mockBusinessId}/reactivate`)
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "INVALID_STATUS_TRANSITION");
    });
  });

  // ==========================================================================
  // 5. Audit Logging & Public Listings
  // ==========================================================================
  describe("Audit Logs & Public Business Listings", () => {
    it("should list platform activity logs with pagination for admins", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [{ count: "2" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
      querySpy.mockResolvedValueOnce({
        rows: [
          {
            id: "log-1",
            business_id: mockBusinessId,
            business_name: "Addis Premier Clinic",
            actor_user_id: mockAdminId,
            actor_email: "admin@platform.example.com",
            action: "BUSINESS_SUSPENDED",
            created_at: new Date(),
          },
          {
            id: "log-2",
            business_id: mockBusinessId,
            business_name: "Addis Premier Clinic",
            actor_user_id: mockAdminId,
            actor_email: "admin@platform.example.com",
            action: "BUSINESS_ACTIVATED",
            created_at: new Date(),
          },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .get("/api/v1/admin/activity-logs?page=1&limit=10")
        .set("Authorization", `Bearer ${mockAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it("should return only active businesses in public GET /api/v1/businesses", async () => {
      const querySpy = vi.spyOn(dbModule, "query");
      querySpy.mockResolvedValueOnce({
        rows: [mockOwnerBusinessRow], // status: 'active'
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const res = await request(app).get("/api/v1/businesses");

      expect(res.status).toBe(200);
      expect(res.body.businesses).toHaveLength(1);
      expect(res.body.businesses[0].status).toBe("active");
    });
  });
});
