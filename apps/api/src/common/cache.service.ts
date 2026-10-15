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

  async close(): Promise<void> {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {}
    }
  }
}
