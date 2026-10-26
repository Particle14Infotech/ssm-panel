import { FastifyInstance, FastifyRequest } from "fastify";
import { CacheLike } from "./cache";
import { ApiError } from "./errors";
import { tokenFingerprint } from "./auth";

interface RateLimitConfig {
  points: number;
  duration: number;
  tier: string;
}

function configFor(request: FastifyRequest): RateLimitConfig {
  const path = request.url;
  if (path.includes("/auth/register")) return { tier: "auth-register", points: 5, duration: 60 };
  if (path.includes("/auth/")) return { tier: "auth", points: 10, duration: 60 };
  if (path.includes("/orders")) return { tier: "orders", points: 30, duration: 60 };
  if (request.headers["x-api-key"]) return { tier: "reseller", points: 300, duration: 60 };
  return { tier: "public", points: 60, duration: 60 };
}

export function registerRateLimit(app: FastifyInstance, cache: CacheLike): void {
  app.addHook("onRequest", async (request, reply) => {
    if (process.env.BENCHMARK_MODE === "true" || process.env.DISABLE_RATE_LIMITER === "true") return;
    const isLocalhost = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip);
    if (process.env.NODE_ENV !== "production" && isLocalhost) return;

    const { tier, points, duration } = configFor(request);
    const apiKey = request.headers["x-api-key"];
    const rawApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    const keySubject = rawApiKey?.slice(0, 8) || tokenFingerprint(request) || request.ip;
    try {
      const count = await cache.increment(`ratelimit:${tier}:${keySubject}`, duration);
      reply.header("X-RateLimit-Limit", points);
      reply.header("X-RateLimit-Remaining", Math.max(0, points - count));
      if (count > points) {
        reply.header("Retry-After", duration);
        throw new ApiError(429, "TOO_MANY_REQUESTS", `Rate limit exceeded for tier [${tier}]. Retry in ${duration} seconds.`);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      request.log.warn({ err: error }, "Rate limiter degraded / failed-open");
    }
  });
}
