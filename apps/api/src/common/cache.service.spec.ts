import { SMMCacheService } from "./cache.service";

describe("SMMCacheService Resilience & Fallback", () => {
  let cache: SMMCacheService;

  beforeEach(() => {
    cache = new SMMCacheService();
  });

  afterEach(async () => {
    await cache.close();
  });

  it("stores and retrieves data through memory fallback during Redis outage", async () => {
    cache.setRedisAvailable(false);

    await cache.set("test-key", { hello: "world" }, { ttlSeconds: 10 });
    const cached = await cache.get<{ hello: string }>("test-key");

    expect(cached).toEqual({ hello: "world" });
  });

  it("invalidates keys properly in memory fallback", async () => {
    cache.setRedisAvailable(false);

    await cache.set("del-key", { value: 123 }, { ttlSeconds: 10 });
    await cache.invalidate("del-key");
    const result = await cache.get("del-key");

    expect(result).toBeNull();
  });

  it("respects TTL expiration in memory fallback", async () => {
    cache.setRedisAvailable(false);

    await cache.set("exp-key", { value: 456 }, { ttlSeconds: 0 });
    const result = await cache.get("exp-key");

    expect(result).toBeNull();
  });
});
