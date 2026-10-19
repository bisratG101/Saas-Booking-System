import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app";

describe("Backend Foundation & App Suite", () => {
  describe("GET /health", () => {
    it("should respond with HTTP 200 and health status payload", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(typeof response.body.uptime).toBe("number");
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
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:5173");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
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
