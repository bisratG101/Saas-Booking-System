import { env } from "../config/env";
import { getStoredToken } from "./token";
import type { ApiErrorPayload } from "../types/api";

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: { path: string; message: string }[];

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.message || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code || "HTTP_ERROR";
    this.details = payload?.details;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Dispatches a global event when a 401 Unauthorized is intercepted.
 */
function handleUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
}

/**
 * Centralized API client wrapper around standard fetch.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers, ...restOptions } = options;

  // Build URL with optional query parameters
  const url = new URL(
    endpoint.startsWith("http") ? endpoint : `${env.API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`
  );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Construct request headers
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Content-Type") && !(restOptions.body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  // Attach Bearer token if present
  const token = getStoredToken();
  if (token && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...restOptions,
      headers: requestHeaders,
    });
  } catch (netErr: any) {
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message: netErr?.message || "Unable to connect to the server. Please check your internet connection.",
    });
  }

  // Handle 401 Unauthorized globally
  if (response.status === 401) {
    handleUnauthorized();
  }

  // Try parsing response JSON
  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // Handle non-2xx HTTP responses
  if (!response.ok) {
    const errorPayload: ApiErrorPayload = data?.error || {
      code: `HTTP_${response.status}`,
      message: response.statusText || `Request failed with status ${response.status}`,
    };
    throw new ApiError(response.status, errorPayload);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
