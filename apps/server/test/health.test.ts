import { buildServer } from "../src/app";

describe("Fastify health foundation", () => {
  it("returns the Nest-compatible liveness envelope with a request id", async () => {
    const originalRedisUrl = process.env.REDIS_URL;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.DATABASE_URL_TEST;
    process.env.NODE_ENV = "test";
    process.env.DISABLE_RATE_LIMITER = "true";
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;
    const app = await buildServer();
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/health/live", headers: { "x-request-id": "health-test" } });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-request-id"]).toBe("health-test");
      expect(response.json()).toEqual(expect.objectContaining({ status: "ok", uptime: expect.any(Number), timestamp: expect.any(String) }));
    } finally {
      await app.close();
      if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = originalRedisUrl;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalTestDatabaseUrl === undefined) delete process.env.DATABASE_URL_TEST;
      else process.env.DATABASE_URL_TEST = originalTestDatabaseUrl;
    }
  });
});
