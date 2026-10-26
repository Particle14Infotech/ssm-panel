import Redis from "ioredis";

interface CacheValue {
  value: string;
  expiresAt: number;
}

export class Cache {
  private readonly memory = new Map<string, CacheValue>();
  private redis: Redis | null = null;

  constructor() {
    try {
      const redisUrl = process.env.REDIS_URL;
      this.redis = redisUrl
        ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
        : null;
      this.redis?.on("error", () => undefined);
      this.redis?.connect().catch(() => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis?.status === "ready") {
      try {
        const value = await this.redis.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        // Use the in-memory compatibility fallback below.
      }
    }
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redis?.status === "ready") {
      try {
        await this.redis.set(key, serialized, "EX", ttlSeconds);
        return;
      } catch {
        // Use the in-memory compatibility fallback below.
      }
    }
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (this.redis?.status === "ready") {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, ttlSeconds);
      return count;
    }
    const entry = await this.get<{ count: number }>(key);
    const count = (entry?.count ?? 0) + 1;
    await this.set(key, { count }, ttlSeconds);
    return count;
  }

  async close(): Promise<void> {
    this.redis?.disconnect();
  }
}

export interface CacheLike {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  close?(): Promise<void>;
}
