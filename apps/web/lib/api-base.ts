/**
 * Centralized API Base URL Resolver
 * 
 * Works across:
 * - Localhost development (with or without custom ports)
 * - Remote VPS deployments (via IP or domain, directly on port 3000 or via Nginx reverse proxy)
 * - Docker container environments (Next.js server rewrite to internal service)
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    const envUrl = process.env.NEXT_PUBLIC_API_URL;

    if (envUrl && envUrl.trim() !== "") {
      const isEnvLocalhost =
        envUrl.includes("localhost") ||
        envUrl.includes("127.0.0.1");

      const isDeadRailway = envUrl.includes("railway.app");

      // On a remote VPS / production host, never let a stale localhost or dead railway URL break API calls!
      if (!isLocalhost && (isEnvLocalhost || isDeadRailway)) {
        return "/api/v1";
      }

      // If user provided a relative path like "/api/v1", use it
      if (envUrl.startsWith("/")) {
        return envUrl.endsWith("/api/v1") ? envUrl : envUrl.replace(/\/+$/, "") + "/api/v1";
      }

      // If user provided a remote URL that matches the current origin or an external API gateway
      return envUrl.endsWith("/api/v1") ? envUrl : envUrl.replace(/\/+$/, "") + "/api/v1";
    }

    // Default browser fallback: relative path "/api/v1"
    // This effortlessly routes via Nginx proxy or Next.js rewrites with zero CORS issues
    return "/api/v1";
  }

  // Server-side (SSR / Next.js server):
  const serverUrl =
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:4000/api/v1";

  return serverUrl.endsWith("/api/v1") ? serverUrl : serverUrl.replace(/\/+$/, "") + "/api/v1";
}
