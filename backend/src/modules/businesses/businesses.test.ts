import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../app";
import * as dbModule from "../../db";
import { signToken } from "../auth/jwt";

describe("Business Management & Tenant Isolation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomerToken = signToken({
    sub: "11111111-1111-1111-1111-111111111111",
    role: "customer",
    email: "customer@example.com",
  });

  const mockOwnerToken = signToken({
    sub: "22222222-2222-2222-2222-222222222222",
    role: "business_owner",
    email: "owner@example.com",
  });

  const mockOtherOwnerToken = signToken({
    sub: "33333333-3333-3333-3333-333333333333",
    role: "business_owner",
    email: "otherowner@example.com",
  });

  const mockAdminToken = signToken({
    sub: "99999999-9999-9999-9999-999999999999",
    role: "platform_admin",
    email: "admin@example.com",
  });

  const mockBusinessId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const mockOtherBusinessId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  describe("POST /api/v1/businesses (Business Creation)", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const response = await request(app)
        .post("/api/v1/businesses")
        .send({
          name: "Addis Dental Clinic",
          timezone: "Africa/Addis_Ababa",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject invalid timezone with 400 validation error", async () => {
      const response = await request(app)
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          name: "Addis Dental Clinic",
          timezone: "Invalid/Timezone_Foo_Bar",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(response.body.error.details[0].message).toContain("Invalid IANA timezone");
    });

    it("should successfully create a business and ignore client-supplied owner_id", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 2. SELECT role FROM platform.users
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: "customer" }] });
      // 3. SELECT id FROM platform.businesses
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 4. INSERT INTO platform.businesses
      const createdBusinessRow = {
        id: mockBusinessId,
        owner_id: "11111111-1111-1111-1111-111111111111", // derived from authenticated token
        name: "Addis Dental Clinic",
        timezone: "Africa/Addis_Ababa",
        status: "active",
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T20:00:00Z"),
      };
      mockClient.query.mockResolvedValueOnce({ rows: [createdBusinessRow] });
      // 5. UPDATE platform.users SET role = 'business_owner'
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 6. INSERT INTO platform.activity_logs
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 7. COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${mockCustomerToken}`)
        .send({
          name: "Addis Dental Clinic",
          timezone: "Africa/Addis_Ababa",
          owner_id: "spoofed-different-owner-uuid-attempt", // Attacker attempts to spoof
        });

      expect(response.status).toBe(201);
      expect(response.body.business).toEqual({
        id: mockBusinessId,
        ownerId: "11111111-1111-1111-1111-111111111111", // Must strictly match authenticated token
        name: "Addis Dental Clinic",
        timezone: "Africa/Addis_Ababa",
        status: "active",
        createdAt: createdBusinessRow.created_at.toISOString(),
        updatedAt: createdBusinessRow.updated_at.toISOString(),
      });

      // Verify the INSERT query strictly used the authenticated user ID and never the spoofed ID
      const insertCall = mockClient.query.mock.calls.find((call) =>
        call[0].includes("INSERT INTO platform.businesses")
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe("11111111-1111-1111-1111-111111111111");
      expect(insertCall[1][0]).not.toBe("spoofed-different-owner-uuid-attempt");
    });

    it("should reject duplicate business creation by the same owner with 409 Conflict", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // SELECT role
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: "business_owner" }] });
      // SELECT existing business (found 1)
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: "existing-business-id" }] });
      // ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          name: "Second Business Attempt",
          timezone: "Africa/Addis_Ababa",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toHaveProperty("code", "BUSINESS_ALREADY_EXISTS");
    });

    it("should reject platform administrators attempting to create a business with 403 Forbidden", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // SELECT role (admin)
      mockClient.query.mockResolvedValueOnce({ rows: [{ role: "platform_admin" }] });
      // ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${mockAdminToken}`)
        .send({
          name: "Admin Business Attempt",
          timezone: "UTC",
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty("code", "FORBIDDEN");
    });
  });

  describe("GET & PATCH /api/v1/businesses/me", () => {
    it("should return 404 if user does not own any business", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get("/api/v1/businesses/me")
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty("code", "BUSINESS_NOT_FOUND");
    });

    it("should return the authenticated owner's business", async () => {
      const businessRow = {
        id: mockBusinessId,
        owner_id: "22222222-2222-2222-2222-222222222222",
        name: "My Specialty Clinic",
        timezone: "Africa/Addis_Ababa",
        status: "active",
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T20:00:00Z"),
      };

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [businessRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get("/api/v1/businesses/me")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.business.name).toBe("My Specialty Clinic");
      expect(response.body.business.ownerId).toBe("22222222-2222-2222-2222-222222222222");
    });

    it("should update business name and timezone safely", async () => {
      const updatedRow = {
        id: mockBusinessId,
        owner_id: "22222222-2222-2222-2222-222222222222",
        name: "Renamed Clinic",
        timezone: "America/New_York",
        status: "active",
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T21:00:00Z"),
      };

      vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner middleware lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockBusinessId,
              owner_id: "22222222-2222-2222-2222-222222222222",
              name: "Old Name",
              timezone: "Africa/Addis_Ababa",
              status: "active",
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. UPDATE query
        .mockResolvedValueOnce({
          rows: [updatedRow],
          rowCount: 1,
          command: "UPDATE",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .patch("/api/v1/businesses/me")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          name: "Renamed Clinic",
          timezone: "America/New_York",
        });

      expect(response.status).toBe(200);
      expect(response.body.business.name).toBe("Renamed Clinic");
      expect(response.body.business.timezone).toBe("America/New_York");
    });
  });

  describe("Services CRUD & Tenant Isolation (/api/v1/businesses/me/services)", () => {
    const mockServiceId = "ssssssss-ssss-ssss-ssss-ssssssssssss";

    it("should reject service creation with duration other than 30 minutes", async () => {
      // requireBusinessOwner resolves business
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/businesses/me/services")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          name: "Haircut",
          duration_minutes: 60, // Invalid in V1!
          price: 500,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(response.body.error.details[0].message).toContain("exactly 30 minutes");
    });

    it("should reject negative service price", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/businesses/me/services")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          name: "Consultation",
          price: -50,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].message).toContain("non-negative");
    });

    it("should successfully create a 30-minute service strictly scoped to the owner business", async () => {
      const serviceRow = {
        id: mockServiceId,
        business_id: mockBusinessId,
        name: "Dental Cleaning",
        description: "Routine checkup and cleaning",
        duration_minutes: 30,
        price: "1500.00",
        is_active: true,
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T20:00:00Z"),
      };

      const querySpy = vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner
        .mockResolvedValueOnce({
          rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. INSERT into booking.services
        .mockResolvedValueOnce({
          rows: [serviceRow],
          rowCount: 1,
          command: "INSERT",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .post("/api/v1/businesses/me/services")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({
          name: "Dental Cleaning",
          description: "Routine checkup and cleaning",
          price: 1500,
          business_id: "attacker-passed-different-id", // Should be ignored
        });

      expect(response.status).toBe(201);
      expect(response.body.service).toEqual({
        id: mockServiceId,
        businessId: mockBusinessId,
        name: "Dental Cleaning",
        description: "Routine checkup and cleaning",
        durationMinutes: 30,
        price: 1500,
        isActive: true,
        createdAt: serviceRow.created_at.toISOString(),
        updatedAt: serviceRow.updated_at.toISOString(),
      });

      // Assert the INSERT strictly used mockBusinessId resolved from PostgreSQL
      const insertCall = querySpy.mock.calls[1];
      expect(insertCall[1]![0]).toBe(mockBusinessId);
      expect(insertCall[1]![0]).not.toBe("attacker-passed-different-id");
    });

    it("should list services for the owner's business", async () => {
      vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner
        .mockResolvedValueOnce({
          rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. SELECT services
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockServiceId,
              business_id: mockBusinessId,
              name: "Dental Cleaning",
              description: null,
              duration_minutes: 30,
              price: "1500.00",
              is_active: true,
              created_at: new Date("2026-10-19T20:00:00Z"),
              updated_at: new Date("2026-10-19T20:00:00Z"),
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .get("/api/v1/businesses/me/services")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.services.length).toBe(1);
      expect(response.body.services[0].name).toBe("Dental Cleaning");
    });

    it("TENANT ISOLATION: should prevent another owner from accessing or modifying another business's service", async () => {
      // Other owner tries to access mockServiceId
      vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner resolves OTHER owner's business (mockOtherBusinessId)
        .mockResolvedValueOnce({
          rows: [{ id: mockOtherBusinessId, owner_id: "33333333-3333-3333-3333-333333333333", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. SELECT query for serviceId with business_id = mockOtherBusinessId returns EMPTY (0 rows)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .get(`/api/v1/businesses/me/services/${mockServiceId}`)
        .set("Authorization", `Bearer ${mockOtherOwnerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty("code", "SERVICE_NOT_FOUND");
    });

    it("should soft-deactivate a service without deleting records", async () => {
      const deactivatedRow = {
        id: mockServiceId,
        business_id: mockBusinessId,
        name: "Dental Cleaning",
        description: null,
        duration_minutes: 30,
        price: "1500.00",
        is_active: false,
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T22:00:00Z"),
      };

      vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner
        .mockResolvedValueOnce({
          rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. UPDATE booking.services SET is_active = FALSE
        .mockResolvedValueOnce({
          rows: [deactivatedRow],
          rowCount: 1,
          command: "UPDATE",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .delete(`/api/v1/businesses/me/services/${mockServiceId}`)
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.service.isActive).toBe(false);
      expect(response.body.message).toContain("deactivated");
    });
  });

  describe("GET /api/v1/businesses/:businessId/services (Public Active Services)", () => {
    it("should return 404 when the requested business does not exist", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app).get(`/api/v1/businesses/${mockBusinessId}/services`);

      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty("code", "BUSINESS_NOT_FOUND");
    });

    it("should return 403 when the business is suspended", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [
          {
            id: mockBusinessId,
            owner_id: "22222222-2222-2222-2222-222222222222",
            name: "Suspended Dental Clinic",
            timezone: "Africa/Addis_Ababa",
            status: "suspended",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app).get(`/api/v1/businesses/${mockBusinessId}/services`);

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty("code", "BUSINESS_SUSPENDED");
    });

    it("should publicly return active services for an active business without authentication", async () => {
      const activeServiceRow = {
        id: "44444444-4444-4444-4444-444444444444",
        business_id: mockBusinessId,
        name: "General Consultation",
        description: "Routine checkup",
        duration_minutes: 30,
        price: "500.00",
        is_active: true,
        created_at: new Date("2026-10-19T20:00:00Z"),
        updated_at: new Date("2026-10-19T20:00:00Z"),
      };

      vi.spyOn(dbModule, "query")
        // 1. SELECT id, ... FROM platform.businesses WHERE id = $1
        .mockResolvedValueOnce({
          rows: [
            {
              id: mockBusinessId,
              owner_id: "22222222-2222-2222-2222-222222222222",
              name: "Active Dental Clinic",
              timezone: "Africa/Addis_Ababa",
              status: "active",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. SELECT id, ... FROM booking.services WHERE business_id = $1 AND is_active = true
        .mockResolvedValueOnce({
          rows: [activeServiceRow],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });

      const response = await request(app).get(`/api/v1/businesses/${mockBusinessId}/services`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("services");
      expect(Array.isArray(response.body.services)).toBe(true);
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].name).toBe("General Consultation");
      expect(response.body.services[0].price).toBe(500);
      expect(response.body.services[0].isActive).toBe(true);
    });
  });
});
