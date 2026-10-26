import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PlatformsController } from "../../api/src/modules/platforms/platforms.controller";
import { PlatformsAdminController } from "../../api/src/modules/platforms/platforms-admin.controller";
import { PlatformsService as NestPlatformsService } from "../../api/src/modules/platforms/platforms.service";
import { PrismaService } from "../../api/src/common/prisma.service";
import { GlobalHttpExceptionFilter } from "../../api/src/common/http-exception.filter";
import { buildServer } from "../src/app";
import { PrismaLike } from "../src/prisma";
import { CacheLike } from "../src/cache";

const TEST_SECRET = "test-jwt-access-secret-32-characters-long!";
process.env.JWT_ACCESS_SECRET = TEST_SECRET;
process.env.JWT_SECRET = TEST_SECRET;
process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMITER = "true";

function createCache(): CacheLike {
  const values = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return (values.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T) {
      values.set(key, value);
    },
    async increment() {
      return 1;
    },
  };
}

function createPrismaMock(): PrismaLike {
  const mockPlatformConfig = {
    id: "plat-1",
    platform: "instagram",
    displayName: "Instagram",
    handleRegex: "^[a-zA-Z0-9._]{1,30}$",
    handleMaxLength: 30,
    hostAllowlist: ["instagram.com", "www.instagram.com"],
    pathPattern: "^/(?:p|reel|tv)/([a-zA-Z0-9_-]+)/?",
    mediaKeyExtractor: "$1",
    urlContainsHandle: false,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 50, exampleMaxQty: 100000 },
    active: true,
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
  };

  const mockBlocklist = {
    id: "blk-1",
    platform: "instagram",
    handle: "badhandle",
    reason: "abuse",
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    platformConfig: {
      findMany: jest.fn().mockResolvedValue([mockPlatformConfig]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.platform === "instagram") return Promise.resolve(mockPlatformConfig);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const matches = where?.OR?.some((cond: any) => cond.id === "plat-1" || cond.platform === "instagram");
        if (matches) return Promise.resolve(mockPlatformConfig);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockPlatformConfig),
      update: jest.fn().mockResolvedValue(mockPlatformConfig),
      upsert: jest.fn().mockResolvedValue(mockPlatformConfig),
    },
    platformHandleBlocklist: {
      findMany: jest.fn().mockResolvedValue([mockBlocklist]),
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(mockBlocklist),
      delete: jest.fn().mockResolvedValue(mockBlocklist),
    },
  };

  return Object.assign(client, {
    isConnected: true,
    client,
  });
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "timestamp" && key !== "uptime" && key !== "requestId")
        .map(([key, child]) => [key, normalize(child)])
    );
  }
  return value;
}

describe("platforms HTTP contract", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    adminToken = "Bearer " + jwt.sign({ id: "admin-1", email: "admin@test.com", role: "ADMIN" }, TEST_SECRET);
    userToken = "Bearer " + jwt.sign({ id: "user-1", email: "user@test.com", role: "USER" }, TEST_SECRET);

    const prismaMock = createPrismaMock();
    const cacheMock = createCache();

    const module = await Test.createTestingModule({
      controllers: [PlatformsController, PlatformsAdminController],
      providers: [
        NestPlatformsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    nestApp = module.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.useGlobalFilters(new GlobalHttpExceptionFilter());
    nestApp.use((req: any, res: any, next: () => void) => {
      res.setHeader("X-Request-Id", req.headers["x-request-id"] || "req_test");
      next();
    });
    await nestApp.init();

    fastifyApp = await buildServer({ prisma: prismaMock, cache: cacheMock });
  });

  afterAll(async () => {
    await fastifyApp.close();
    await nestApp.close();
  });

  it.each([
    "/api/v1/platforms",
    "/api/v1/platforms/instagram",
  ])("matches NestJS for public GET %s", async (path) => {
    const nestResponse = await request(nestApp.getHttpServer()).get(path).set("X-Request-Id", "plat-contract");
    const fastifyResponse = await fastifyApp.inject({ method: "GET", url: path, headers: { "x-request-id": "plat-contract" } });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 404 for unknown platform config", async () => {
    const nestResponse = await request(nestApp.getHttpServer()).get("/api/v1/platforms/unknown-xyz").set("X-Request-Id", "err-test");
    const fastifyResponse = await fastifyApp.inject({ method: "GET", url: "/api/v1/platforms/unknown-xyz", headers: { "x-request-id": "err-test" } });

    expect(fastifyResponse.statusCode).toBe(404);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 401 on admin endpoint without token", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/platforms")
      .set("X-Request-Id", "unauth-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/admin/platforms",
      headers: { "x-request-id": "unauth-test" },
    });

    expect(fastifyResponse.statusCode).toBe(401);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 403 on admin endpoint with non-admin token", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/platforms")
      .set("Authorization", userToken)
      .set("X-Request-Id", "forbidden-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/admin/platforms",
      headers: { "x-request-id": "forbidden-test", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(403);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin list platforms", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/platforms")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-list-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/admin/platforms",
      headers: { "x-request-id": "admin-list-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin list blocklist", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/platforms/blocklist")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-blocklist-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/admin/platforms/blocklist",
      headers: { "x-request-id": "admin-blocklist-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 201 on admin add blocklist", async () => {
    const payload = { platform: "instagram", handle: "baduser", reason: "spam" };
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/admin/platforms/blocklist")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "add-blocklist-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/admin/platforms/blocklist",
      headers: { "x-request-id": "add-blocklist-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(201);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin remove blocklist", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .delete("/api/v1/admin/platforms/blocklist/blk-1")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "del-blocklist-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "DELETE",
      url: "/api/v1/admin/platforms/blocklist/blk-1",
      headers: { "x-request-id": "del-blocklist-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin update platform config", async () => {
    const payload = { displayName: "Updated Instagram" };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/admin/platforms/plat-1")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "update-plat-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/admin/platforms/plat-1",
      headers: { "x-request-id": "update-plat-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });
});
