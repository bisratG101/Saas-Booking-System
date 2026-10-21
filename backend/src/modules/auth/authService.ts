import { query } from "../../db";
import { hashPassword, verifyPassword } from "./password";
import { signToken } from "./jwt";
import { RegisterInput, LoginInput } from "./schemas";
import { SafeUser, AuthSuccessResponse, UserRecord } from "./types";

export class EmailAlreadyExistsError extends Error {
  constructor(message = "An account with this email already exists") {
    super(message);
    this.name = "EmailAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Registers a new customer account.
 * Server strictly forces role = 'customer'.
 * Normalizes email to lowercase.
 */
export async function registerCustomer(input: RegisterInput): Promise<SafeUser> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const normalizedPhone = input.phone ? input.phone.trim() : null;

  try {
    const result = await query<UserRecord>(
      `INSERT INTO platform.users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, name, email, phone, role, created_at;`,
      [input.name.trim(), normalizedEmail, normalizedPhone, passwordHash]
    );

    const user = result.rows[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
    };
  } catch (err: any) {
    // PostgreSQL error code 23505 = unique_violation
    if (err.code === "23505") {
      throw new EmailAlreadyExistsError();
    }
    throw err;
  }
}

/**
 * Authenticates user by email and password, returning a signed JWT and safe user profile.
 * Emits a generic error for non-existent emails or incorrect passwords.
 */
export async function login(input: LoginInput): Promise<AuthSuccessResponse> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const result = await query<UserRecord>(
    `SELECT id, name, email, phone, password_hash, role, created_at
     FROM platform.users
     WHERE LOWER(email) = LOWER($1);`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    throw new InvalidCredentialsError();
  }

  const user = result.rows[0];
  const isValidPassword = await verifyPassword(input.password, user.password_hash);

  if (!isValidPassword) {
    throw new InvalidCredentialsError();
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    token,
    expiresIn: 3600, // 1 hour per design.md
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
    },
  };
}
