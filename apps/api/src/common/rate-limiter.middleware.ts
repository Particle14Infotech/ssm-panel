import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

interface RateLimitConfig {
  points: number; // Max hits
  duration: number; // Per seconds
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private redis: Redis | null = null;
  private memoryStore = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          family: 0,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null,
        });
      } else {
        const host = process.env.REDIS_HOST || "localhost";
        const port = parseInt(process.env.REDIS_PORT || "6379", 10);
        this.redis = new Redis({
          host,
          port,
          maxRetriesPerRequest: 1,
          connectTimeout: 500,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null,
        });
      }
      this.redis.on("error", () => {
        // Suppress unhandled error event and degrade to in-memory store
      });
      this.redis.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (process.env.BENCHMARK_MODE === "true" || process.env.DISABLE_RATE_LIMITER === "true") {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const apiKey = req.headers["x-api-key"] as string | undefined;

    // In local development or testing environments, bypass rate limiter for localhost
    const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    if (process.env.NODE_ENV !== "production" && isLocalhost) {
      return next();
    }

    // Determine limit tier
    let tier = "public";
    let config: RateLimitConfig = { points: 60, duration: 60 }; // 60 req/min for general API

    if (req.originalUrl.includes("/auth/register")) {
      tier = "auth-register";
      config = { points: 5, duration: 60 }; // 5 req/min for registration
    } else if (req.originalUrl.includes("/auth/")) {
      tier = "auth";
      config = { points: 10, duration: 60 }; // 10 req/min for login and auth mutations
    } else if (req.originalUrl.includes("/orders")) {
      tier = "orders";
      config = { points: 30, duration: 60 }; // 30 req/min for order mutations
    } else if (apiKey) {
      tier = "reseller";
      config = { points: 300, duration: 60 }; // 300 req/min for authenticated resellers
    }

    const key = `ratelimit:${tier}:${apiKey ? apiKey.substring(0, 8) : ip}`;

    try {
      if (this.redis && this.redis.status === "ready") {
        const current = await this.redis.incr(key);
        if (current === 1) {
          await this.redis.expire(key, config.duration);
        }
        res.setHeader("X-RateLimit-Limit", config.points);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, config.points - current));

        if (current > config.points) {
          res.setHeader("Retry-After", config.duration);
          throw new HttpException(
            {
              code: "TOO_MANY_REQUESTS",
              message: `Rate limit exceeded for tier [${tier}]. Retry in ${config.duration} seconds.`,
            },
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      } else {
        // In-memory fallback
        const now = Date.now();
        const entry = this.memoryStore.get(key);
        if (!entry || now > entry.resetAt) {
          this.memoryStore.set(key, { count: 1, resetAt: now + config.duration * 1000 });
        } else {
          entry.count += 1;
          if (entry.count > config.points) {
            res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
            throw new HttpException(
              {
                code: "TOO_MANY_REQUESTS",
                message: `Rate limit exceeded for tier [${tier}].`,
              },
              HttpStatus.TOO_MANY_REQUESTS
            );
          }
        }
      }
      next();
    } catch (err: any) {
      if (err instanceof HttpException) {
        next(err);
      } else {
        console.warn("[RateLimiter] Rate limiter degraded / failed-open:", err?.message || err);
        next();
      }
    }
  }
}
