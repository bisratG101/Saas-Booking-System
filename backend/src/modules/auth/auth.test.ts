import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../app";
import * as dbModule from "../../db";
import { hashPassword, verifyPassword } from "./password";
import { signToken, verifyToken, AuthTokenError } from "./jwt";
import { env } from "../../config/env";

describe("Authentication & User Accounts Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Security (bcrypt)", () => {
    it("should hash a plaintext password and never return the plaintext", async () => {
      const plaintext = "mySuperSecretPassword123";
      const hash = await hashPassword(plaintext);

      expect(hash).not.toBe(plaintext);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/); // Standard bcrypt hash format
    });

    it("should verify correct password and reject incorrect password", async () => {
      const plaintext = "correctPassword123";
      const hash = await hashPassword(plaintext);

      const isValid = await verifyPassword(plaintext, hash);
      const isInvalid = await verifyPassword("wrongPassword456", hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe("JWT Operations", () => {
    it("should sign a valid JWT token with 1-hour expiration and correct claims", () => {
      const payload = {
        sub: "123e4567-e89b-12d3-a456-426614174000",
        role: "customer" as const,
        email: "customer@example.com",
      };

      const token = signToken(payload);
      expect(typeof token).toBe("string");

      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.email).toBe(payload.email);

      // Verify raw payload has exp set to approximately 1 hour (3600 seconds) from now
      const rawDecoded = jwt.decode(token) as jwt.JwtPayload;
      expect(rawDecoded.exp).toBeDefined();
      expect(rawDecoded.iat).toBeDefined();
      expect(rawDecoded.exp! - rawDecoded.iat!).toBe(3600);
    });

    it("should reject expired tokens safely", () => {
      // Create a token expired in the past
      const expiredToken = jwt.sign(
        { sub: "123", role: "customer", email: "user@example.com" },
        env.JWT_SECRET,
        { expiresIn: "-1s" }
      );

      expect(() => verifyToken(expiredToken)).toThrow(AuthTokenError);
      try {
        verifyToken(expiredToken);
      } catch (err: any) {
        expect(err.code).toBe("TOKEN_EXPIRED");
      }
    });

    it("should reject invalid signature tokens safely", () => {
      const forgedToken = jwt.sign(
        { sub: "123", role: "customer", email: "user@example.com" },
        "wrong-secret-key-that-does-not-match-env-key-32-chars!"
      );

      expect(() => verifyToken(forgedToken)).toThrow(AuthTokenError);
      try {
        verifyToken(forgedToken);
      } catch (err: any) {
        expect(err.code).toBe("TOKEN_INVALID");
      }
    });
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a customer and return safe user info", async () => {
      const mockUserRow = {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        name: "Alice Smith",
        email: "alice@example.com",
        phone: "+251911223344",
        role: "customer",
        created_at: new Date("2026-10-19T20:00:00Z"),
      };

      const querySpy = vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Alice Smith",
          email: "ALICE@EXAMPLE.COM", // test lowercase normalization
          password: "password12345",
          phone: "+251911223344",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user: {
          id: mockUserRow.id,
          name: mockUserRow.name,
          email: mockUserRow.email,
          phone: mockUserRow.phone,
          role: "customer",
          createdAt: mockUserRow.created_at.toISOString(),
        },
      });

      // Assert password was hashed and email normalized before SQL query
      expect(querySpy).toHaveBeenCalledTimes(1);
      const queryArgs = querySpy.mock.calls[0][1] as any[];
      expect(queryArgs[0]).toBe("Alice Smith");
      expect(queryArgs[1]).toBe("alice@example.com"); // normalized lowercase
      expect(queryArgs[2]).toBe("+251911223344");
      expect(queryArgs[3]).not.toBe("password12345"); // password MUST be hashed
      expect(queryArgs[3]).toMatch(/^\$2[aby]\$/);
    });

    it("should reject invalid registration input (validation errors)", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "",
          email: "invalid-email-format",
          password: "short", // < 8 characters
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(response.body.error.details.length).toBeGreaterThanOrEqual(3);
    });

    it("should return 409 Conflict if email already exists", async () => {
      const duplicateError: any = new Error("Unique constraint violation");
      duplicateError.code = "23505";

      vi.spyOn(dbModule, "query").mockRejectedValueOnce(duplicateError);

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Duplicate User",
          email: "existing@example.com",
          password: "securepassword123",
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists",
        },
      });
    });

    it("should not allow client to assign privileged roles via public registration", async () => {
      const mockUserRow = {
        id: "b2c3d4e5-f6a7-8901-bcde-f23456789012",
        name: "Hacker Attempt",
        email: "hacker@example.com",
        phone: null,
        role: "customer", // server strictly sets role to customer
        created_at: new Date("2026-10-19T20:00:00Z"),
      };

      const querySpy = vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [mockUserRow],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Hacker Attempt",
          email: "hacker@example.com",
          password: "securepassword123",
          role: "platform_admin", // client attempt to escalate privileges
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("customer");

      // Verify that SQL query always inserts 'customer'
      const sql = querySpy.mock.calls[0][0];
      expect(sql).toContain("'customer'");
      expect(sql).not.toContain("platform_admin");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should log in successfully with valid credentials and return 1h token", async () => {
      const passwordHash = await hashPassword("validPassword123");

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [
          {
            id: "c3d4e5f6-a7b8-9012-cdef-345678901234",
            name: "Bob Jones",
            email: "bob@example.com",
            phone: null,
            password_hash: passwordHash,
            role: "customer",
            created_at: new Date("2026-10-19T20:00:00Z"),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "bob@example.com",
          password: "validPassword123",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body.expiresIn).toBe(3600);
      expect(response.body.user).toEqual({
        id: "c3d4e5f6-a7b8-9012-cdef-345678901234",
        name: "Bob Jones",
        email: "bob@example.com",
        phone: null,
        role: "customer",
        createdAt: new Date("2026-10-19T20:00:00Z").toISOString(),
      });
      expect(response.body.user).not.toHaveProperty("password_hash");
    });

    it("should return generic 401 error for incorrect password", async () => {
      const passwordHash = await hashPassword("realPassword123");

      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [
          {
            id: "c3d4e5f6-a7b8-9012-cdef-345678901234",
            name: "Bob Jones",
            email: "bob@example.com",
            phone: null,
            password_hash: passwordHash,
            role: "customer",
            created_at: new Date("2026-10-19T20:00:00Z"),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "bob@example.com",
          password: "wrongPassword999",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    });

    it("should return generic 401 error for non-existent email (timing safe)", async () => {
      vi.spyOn(dbModule, "query").mockResolvedValueOnce({
        rows: [], // User not found
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nobody@example.com",
          password: "somepassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    });
  });

  describe("Authentication Middleware (GET /api/v1/auth/me)", () => {
    it("should return 401 if Authorization header is missing", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization token required",
        },
      });
    });

    it("should return 401 if Authorization header is malformed (not Bearer)", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Basic 12345678");

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "UNAUTHORIZED");
    });

    it("should return 401 if token is expired", async () => {
      const expiredToken = jwt.sign(
        { sub: "user-123", role: "customer", email: "user@example.com" },
        env.JWT_SECRET,
        { expiresIn: "-10s" }
      );

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "TOKEN_EXPIRED");
    });

    it("should return 401 if token signature is invalid", async () => {
      const invalidToken = jwt.sign(
        { sub: "user-123", role: "customer", email: "user@example.com" },
        "forged-secret-key-random-untrusted-key-32-chars!"
      );

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code", "INVALID_TOKEN");
    });

    it("should allow access and expose req.user when valid Bearer token is provided", async () => {
      const validToken = signToken({
        sub: "user-uuid-1234",
        role: "customer",
        email: "customer@example.com",
      });

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: "user-uuid-1234",
          role: "customer",
          email: "customer@example.com",
        },
      });
    });
  });

  describe("Database Error Handling", () => {
    it("should safely handle database failure during registration without leaking stack trace", async () => {
      vi.spyOn(dbModule, "query").mockRejectedValueOnce(
        new Error("Connection reset by peer: PostgreSQL crash")
      );

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "password12345",
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toHaveProperty("code", "INTERNAL_SERVER_ERROR");
      expect(response.body.error).not.toHaveProperty("password");
    });
  });
});
