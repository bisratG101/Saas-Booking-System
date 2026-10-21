/**
 * Frontend Environment Configuration
 *
 * Centralizes access to Vite client environment variables.
 * Note: All variables exposed to Vite must start with VITE_ and contain no sensitive secrets.
 */
function normalizeApiUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return "http://localhost:4000/api/v1";
  }
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  // Ensure the URL always ends with /api/v1 even if omitted in deployment settings
  if (!trimmed.endsWith("/api/v1")) {
    return `${trimmed}/api/v1`;
  }
  return trimmed;
}

export const env = {
  API_URL: normalizeApiUrl(import.meta.env.VITE_API_URL as string),
};
