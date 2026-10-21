import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "./app";
import * as dbModule from "./db";

describe("Backend Foundation & App Suite", () => {
  describe("GET /health", () => {
    it("should respond with HTTP 200 and unconfigured status when DATABASE_URL is not set", async () => {
      const spy = vi.spyOn(dbModule, "checkDatabaseHealth").mockResolvedValueOnce({
        isConfigured: false,
        isHealthy: false,
      });

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body.database).toEqual({ status: "unconfigured" });

      spy.mockRestore();
    });

    it("should respond with HTTP 200 and connected status when database is reachable", async () => {
      const spy = vi.spyOn(dbModule, "checkDatabaseHealth").mockResolvedValueOnce({
        isConfigured: true,
        isHealthy: true,
        latencyMs: 12,
      });

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.database).toEqual({
        status: "connected",
        latencyMs: 12,
      });

      spy.mockRestore();
    });

    it("should respond with HTTP 503 and safe degraded status when database is unreachable", async () => {
      const spy = vi.spyOn(dbModule, "checkDatabaseHealth").mockResolvedValueOnce({
        isConfigured: true,
        isHealthy: false,
        error: "Database connection failed",
      });

      const response = await request(app).get("/health");

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("degraded");
      expect(response.body.database).toEqual({
        status: "disconnected",
        error: "Database unreachable",
      });

      spy.mockRestore();
    });
  });

  describe("404 Not Found Handling", () => {
    it("should return HTTP 404 with structured JSON error for undefined GET route", async () => {
      const response = await request(app).get("/api/v1/unknown-endpoint");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Route not found: GET /api/v1/unknown-endpoint",
        },
      });
    });

    it("should return HTTP 404 with structured JSON error for undefined POST route", async () => {
      const response = await request(app)
        .post("/api/v1/unknown-endpoint")
        .send({ foo: "bar" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Route not found: POST /api/v1/unknown-endpoint",
        },
      });
    });
  });

  describe("CORS Handling", () => {
    it("should permit requests from the configured frontend origin", async () => {
      const spy = vi.spyOn(dbModule, "checkDatabaseHealth").mockResolvedValueOnce({
        isConfigured: true,
        isHealthy: true,
        latencyMs: 5,
      });

      const response = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:5173");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

      spy.mockRestore();
    });

    it("should reject requests from an unauthorized origin", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://malicious-site.example.com");

      // When CORS middleware rejects an origin, it calls next(err) which hits errorHandler
      expect(response.status).toBe(500);
      expect(response.body.error).toHaveProperty("code", "INTERNAL_SERVER_ERROR");
    });
  });
});
