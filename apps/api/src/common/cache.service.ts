import Redis from "ioredis";

export interface CacheOptions {
  ttlSeconds: number;
  jitterSeconds?: number;
}

export class SMMCacheService {
  private redis: any;
  private inMemoryFallback = new Map<string, { value: string; expiresAt: number }>();
  private redisAvailable = true;

  constructor(redisClient?: any) {
    if (redisClient) {
      this.redis = redisClient;
    } else {
      if (
        process.env.NODE_ENV === "test" ||
        process.env.CI === "true" ||
        (!process.env.REDIS_URL && !process.env.REDIS_HOST)
      ) {
        this.redis = null;
        this.redisAvailable = false;
        return;
      }
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl, {
            family: 0,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            enableOfflineQueue: false,
          });
        } else {
          const host = process.env.REDIS_HOST || "localhost";
          const port = parseInt(process.env.REDIS_PORT || "6379", 10);
          this.redis = new Redis({
            host,
            port,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 500,
            enableOfflineQueue: false,
          });
        }
      } catch {
        this.redis = null;
        this.redisAvailable = false;
      }
    }
  }

  // Simulate Redis outage for failure testing
  setRedisAvailable(available: boolean) {
    this.redisAvailable = available;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisAvailable || !this.redis) {
      // Graceful in-memory fallback
      const item = this.inMemoryFallback.get(key);
      if (!item) return null;
      if (Date.now() >= item.expiresAt) {
        this.inMemoryFallback.delete(key);
        return null;
      }
      return JSON.parse(item.value);
    }

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    // Stampede protection: apply random jitter to TTL
    const jitter = options.jitterSeconds ? Math.floor(Math.random() * options.jitterSeconds) : 0;
    const finalTtl = options.ttlSeconds + jitter;
    const serialized = JSON.stringify(value);

    if (!this.redisAvailable || !this.redis) {
      this.inMemoryFallback.set(key, {
        value: serialized,
        expiresAt: Date.now() + finalTtl * 1000,
      });
      return;
    }

    try {
      await this.redis.set(key, serialized, "EX", finalTtl);
    } catch {
      this.inMemoryFallback.set(key, {
        value: serialized,
        expiresAt: Date.now() + finalTtl * 1000,
      });
    }
  }

  async invalidate(key: string): Promise<void> {
    this.inMemoryFallback.delete(key);
    if (this.redisAvailable && this.redis) {
      try {
        await this.redis.del(key);
      } catch {}
    }
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    if (this.redisAvailable && this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, windowSeconds);
        }
        if (count > limit) {
          const ttl = await this.redis.ttl(key);
          return { allowed: false, remaining: 0, retryAfter: Math.max(1, ttl) };
        }
        return { allowed: true, remaining: limit - count, retryAfter: 0 };
      } catch {
        // Fall back to memory store on redis error
      }
    }

    const now = Date.now();
    const memKey = `ratelimit:${key}`;
    const entry = this.inMemoryFallback.get(memKey);
    let data: { count: number; resetAt: number };
    if (!entry || now >= entry.expiresAt) {
      data = { count: 1, resetAt: now + windowSeconds * 1000 };
    } else {
      const parsed = JSON.parse(entry.value);
      data = { count: parsed.count + 1, resetAt: parsed.resetAt };
    }
    this.inMemoryFallback.set(memKey, {
      value: JSON.stringify(data),
      expiresAt: data.resetAt,
    });
    if (data.count > limit) {
      const retryAfter = Math.ceil((data.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
    }
    return { allowed: true, remaining: limit - data.count, retryAfter: 0 };
  }

  async close(): Promise<void> {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {}
    }
  }
}

export const CacheService = SMMCacheService;
export type CacheService = SMMCacheService;
