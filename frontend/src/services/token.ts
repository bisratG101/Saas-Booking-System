const TOKEN_STORAGE_KEY = "saas_booking_auth_token";
const USER_STORAGE_KEY = "saas_booking_auth_user";

import type { SafeUser } from "../types/api";

/**
 * Retrieves the stored JWT from local storage.
 */
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the JWT in local storage.
 */
export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.error("Failed to persist authentication token:", err);
  }
}

/**
 * Clears the stored JWT.
 */
export function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to remove authentication token:", err);
  }
}

/**
 * Retrieves cached user info from local storage.
 */
export function getStoredUser(): SafeUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Stores cached user info in local storage.
 */
export function setStoredUser(user: SafeUser): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error("Failed to persist user profile:", err);
  }
}

/**
 * Clears cached user profile.
 */
export function removeStoredUser(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to remove user profile:", err);
  }
}

/**
 * Clears all authentication state.
 */
export function clearAuthStorage(): void {
  removeStoredToken();
  removeStoredUser();
}
