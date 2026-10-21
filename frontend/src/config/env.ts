/**
 * Frontend Environment Configuration
 *
 * Centralizes access to Vite client environment variables.
 * Note: All variables exposed to Vite must start with VITE_ and contain no sensitive secrets.
 */
export const env = {
  API_URL: (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api/v1",
};
