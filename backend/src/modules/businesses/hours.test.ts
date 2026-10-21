import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../app";
import * as dbModule from "../../db";
import { signToken } from "../auth/jwt";

describe("Business Hours & Working Schedules Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  const mockCustomerToken = signToken({
    sub: "11111111-1111-1111-1111-111111111111",
    role: "customer",
    email: "customer@example.com",
  });

  const mockBusinessId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const mockOtherBusinessId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  const validWeeklySchedule = [
    { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 2, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 6, open_time: "10:00", close_time: "15:00", is_closed: false },
    { day_of_week: 7, open_time: null, close_time: null, is_closed: true },
  ];

  describe("Authentication & Authorization", () => {
    it("should reject unauthenticated GET requests with 401", async () => {
      const response = await request(app).get("/api/v1/businesses/me/hours");

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject unauthenticated PUT requests with 401", async () => {
      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .send({ hours: validWeeklySchedule });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should reject a user who does not own a business with 403 Forbidden", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .get("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty("code", "FORBIDDEN");
    });
  });

  describe("Validation Rules", () => {
    it("should reject a schedule missing weekdays (e.g. only 6 days)", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const incompleteSchedule = validWeeklySchedule.slice(0, 6);

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: incompleteSchedule });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(response.body.error.details[0].message).toContain("exactly 7 days");
    });

    it("should reject duplicate weekdays", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const duplicateDaysSchedule = [
        { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false },
        { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false }, // Duplicate day 1
        { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_closed: false },
        { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_closed: false },
        { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_closed: false },
        { day_of_week: 6, open_time: "10:00", close_time: "15:00", is_closed: false },
        { day_of_week: 7, open_time: null, close_time: null, is_closed: true },
      ];

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: duplicateDaysSchedule });

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].message).toContain("exactly one entry for each day");
    });

    it("should reject invalid weekday values (e.g. day 0 or day 8)", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const invalidDays = [
        { day_of_week: 0, open_time: "09:00", close_time: "17:00", is_closed: false },
        ...validWeeklySchedule.slice(1),
      ];

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: invalidDays });

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].message).toContain("between 1 (Monday) and 7 (Sunday)");
    });

    it("should reject invalid time formats (e.g. '9am', '25:00')", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const invalidTimeSchedule = [
        { day_of_week: 1, open_time: "25:00", close_time: "17:00", is_closed: false },
        ...validWeeklySchedule.slice(1),
      ];

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: invalidTimeSchedule });

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].message).toContain("HH:MM 24-hour format");
    });

    it("should reject closing time equal to or earlier than opening time for open days (overnight hours rejected)", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      // Day 1 has close_time 09:00 equal to open_time 09:00
      const equalTimesSchedule = [
        { day_of_week: 1, open_time: "09:00", close_time: "09:00", is_closed: false },
        ...validWeeklySchedule.slice(1),
      ];

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: equalTimesSchedule });

      expect(response.status).toBe(400);
      expect(response.body.error.details[0].message).toContain("close_time must be later than open_time");
    });

    it("should require open_time and close_time when is_closed is false", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const missingTimesSchedule = [
        { day_of_week: 1, open_time: null, close_time: null, is_closed: false },
        ...validWeeklySchedule.slice(1),
      ];

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: missingTimesSchedule });

      expect(response.status).toBe(400);
      expect(response.body.error.details.some((d: any) => d.message.includes("is required when is_closed is false"))).toBe(true);
    });
  });

  describe("GET /api/v1/businesses/me/hours", () => {
    it("should retrieve the owner's configured business hours", async () => {
      const mockHoursRows = [
        { id: "h1", business_id: mockBusinessId, day_of_week: 1, open_time: "09:00:00", close_time: "17:00:00", is_closed: false },
        { id: "h2", business_id: mockBusinessId, day_of_week: 2, open_time: "09:00:00", close_time: "17:00:00", is_closed: false },
        { id: "h3", business_id: mockBusinessId, day_of_week: 7, open_time: null, close_time: null, is_closed: true },
      ];

      vi.spyOn(dbModule, "query")
        // 1. requireBusinessOwner
        .mockResolvedValueOnce({
          rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        // 2. SELECT booking.business_hours
        .mockResolvedValueOnce({
          rows: mockHoursRows,
          rowCount: 3,
          command: "SELECT",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .get("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.hours.length).toBe(3);
      expect(response.body.hours[0]).toEqual({
        id: "h1",
        businessId: mockBusinessId,
        dayOfWeek: 1,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: false,
      });
      expect(response.body.hours[2]).toEqual({
        id: "h3",
        businessId: mockBusinessId,
        dayOfWeek: 7,
        openTime: null,
        closeTime: null,
        isClosed: true,
      });
    });
  });

  describe("PUT /api/v1/businesses/me/hours", () => {
    it("should atomically replace the complete weekly schedule using a database transaction", async () => {
      // 1. requireBusinessOwner
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // 7 upsert queries (one for each day 1..7)
      for (let i = 1; i <= 7; i++) {
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              id: `hour-${i}`,
              business_id: mockBusinessId,
              day_of_week: i,
              open_time: i === 7 ? null : "09:00:00",
              close_time: i === 7 ? null : "17:00:00",
              is_closed: i === 7,
            },
          ],
        });
      }

      // activity log query
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: validWeeklySchedule });

      expect(response.status).toBe(200);
      expect(response.body.hours.length).toBe(7);
      expect(response.body.hours[0].dayOfWeek).toBe(1);
      expect(response.body.hours[6].isClosed).toBe(true);

      // Verify BEGIN and COMMIT were invoked
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN;");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT;");
      expect(mockClient.release).toHaveBeenCalled();

      // Verify all writes were scoped strictly to mockBusinessId
      const insertCalls = mockClient.query.mock.calls.filter((c) =>
        c[0].includes("INSERT INTO booking.business_hours")
      );
      expect(insertCalls.length).toBe(7);
      for (const call of insertCalls) {
        expect(call[1][0]).toBe(mockBusinessId);
      }
    });

    it("should rollback the transaction completely if a database error occurs", async () => {
      // 1. requireBusinessOwner
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [{ id: mockBusinessId, owner_id: "22222222-2222-2222-2222-222222222222", status: "active" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };

      vi.spyOn(dbModule, "getClient").mockResolvedValueOnce(mockClient as any);

      // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Day 1 succeeds
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: "h1", business_id: mockBusinessId, day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false }],
      });
      // Day 2 fails with database constraint error
      mockClient.query.mockRejectedValueOnce(new Error("Check constraint violation"));
      // ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOwnerToken}`)
        .send({ hours: validWeeklySchedule });

      expect(response.status).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK;");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("TENANT ISOLATION: should not allow an owner to read or modify another business's schedule", async () => {
      // Owner B attempts to GET /api/v1/businesses/me/hours
      // requireBusinessOwner resolves mockOtherBusinessId
      vi.spyOn(dbModule, "query")
        .mockResolvedValueOnce({
          rows: [{ id: mockOtherBusinessId, owner_id: "33333333-3333-3333-3333-333333333333", status: "active" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [], // No hours for Owner B yet
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        });

      const response = await request(app)
        .get("/api/v1/businesses/me/hours")
        .set("Authorization", `Bearer ${mockOtherOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.hours).toEqual([]);
    });
  });
});
