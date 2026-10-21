export type UserRole = "platform_admin" | "business_owner" | "customer";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface AuthSuccessResponse {
  token: string;
  expiresIn: number;
  user: SafeUser;
}
