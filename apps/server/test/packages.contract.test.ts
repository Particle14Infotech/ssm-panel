import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PackagesController } from "../../api/src/modules/packages/packages.controller";
import { PackagesService as NestPackagesService } from "../../api/src/modules/packages/packages.service";
import { PackagesQuoteService as NestPackagesQuoteService } from "../../api/src/modules/packages/packages-quote.service";
import { PlatformsService as NestPlatformsService } from "../../api/src/modules/platforms/platforms.service";
import { PrismaService } from "../../api/src/common/prisma.service";
import { GlobalHttpExceptionFilter } from "../../api/src/common/http-exception.filter";
import { buildServer } from "../src/app";
import { PrismaLike } from "../src/prisma";
import { CacheLike } from "../src/cache";
import { Decimal } from "decimal.js";

const TEST_SECRET = "test-jwt-access-secret-32-characters-long!";
process.env.JWT_ACCESS_SECRET = TEST_SECRET;
process.env.JWT_SECRET = TEST_SECRET;
process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMITER = "true";
process.env.PACKAGES_ENABLED = "true";

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

function makeToken(role: string, id = "user-1") {
  return jwt.sign({ sub: id, id, email: `${role.toLowerCase()}@test.com`, role }, TEST_SECRET, { expiresIn: "1h" });
}

function createPrismaMock(): PrismaLike {
  const mockService = {
    id: "1042",
    name: "Instagram Followers",
    displayName: "Instagram Followers",
    platform: "INSTAGRAM",
    ratePer1000: new Decimal(180.0),
    minQty: 10,
    maxQty: 100000,
    costINR: new Decimal(120.0),
    status: "ACTIVE",
    active: true,
    isDeleted: false,
    packageEligible: true,
  };

  const mockPackage: any = {
    id: "pkg-1",
    userId: "user-1",
    platform: "instagram",
    handle: "testuser",
    timezone: "UTC",
    durationDays: 30,
    reserveTotal: new Decimal(180.0),
    status: "ACTIVE",
    startAt: new Date("2026-10-27T00:00:00.000Z"),
    endAt: new Date("2026-11-27T00:00:00.000Z"),
    idempotencyKey: "idem-pkg-1",
    rules: [
      {
        id: "rule-1",
        packageId: "pkg-1",
        kind: "TIME_DRIP",
        serviceId: "1042",
        quantityPerPost: 1000,
        maxPosts: 1,
        usedCount: 0,
        unitCharge: new Decimal(180.0),
        rateSnapshot: new Decimal(180.0),
        reserve: new Decimal(180.0),
        service: mockService,
      },
    ],
    executions: [
      {
        id: "exec-1",
        packageId: "pkg-1",
        serviceId: "1042",
        seq: 1,
        executeAt: new Date("2026-10-27T01:00:00.000Z"),
        status: "SCHEDULED",
        source: "SCHEDULE",
        quantity: 1000,
        remainingQuantity: 1000,
        allocatedCharge: new Decimal(180.0),
        service: mockService,
      },
    ],
    triggers: [],
    user: { id: "user-1", email: "user@test.com" },
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    package: {
      findMany: jest.fn().mockResolvedValue([mockPackage]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "pkg-1") return Promise.resolve(mockPackage);
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "pkg-1") return Promise.resolve(mockPackage);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockPackage),
      update: jest.fn().mockResolvedValue(mockPackage),
    },
    packageRule: {
      findMany: jest.fn().mockResolvedValue(mockPackage.rules),
      create: jest.fn().mockResolvedValue(mockPackage.rules[0]),
      update: jest.fn().mockResolvedValue(mockPackage.rules[0]),
    },
    packageExecution: {
      findMany: jest.fn().mockResolvedValue(mockPackage.executions),
      findUnique: jest.fn().mockResolvedValue(mockPackage.executions[0]),
      findFirst: jest.fn().mockResolvedValue(mockPackage.executions[0]),
      create: jest.fn().mockResolvedValue(mockPackage.executions[0]),
      update: jest.fn().mockResolvedValue(mockPackage.executions[0]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    packageTrigger: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "trig-1", packageId: "pkg-1", mediaKey: "post123" }),
      update: jest.fn().mockResolvedValue({ id: "trig-1", targetUrl: "https://instagram.com/p/updated" }),
    },
    service: {
      findMany: jest.fn().mockResolvedValue([mockService]),
      findUnique: jest.fn().mockResolvedValue(mockService),
    },
    platformConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    platformHandleBlocklist: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    wallet: {
      findUnique: jest.fn().mockResolvedValue({ id: "wal-1", userId: "user-1", balance: "10000.00" }),
      update: jest.fn().mockResolvedValue({ id: "wal-1", balance: "9820.00" }),
    },
    ledgerEntry: {
      create: jest.fn().mockResolvedValue({ id: "led-1" }),
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
        .filter(([k]) => !["requestId", "timestamp", "quoteHash", "expiresAt", "scheduledAt"].includes(k))
        .map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

describe("Packages contract parity (NestJS vs Fastify)", () => {
  let nestApp: INestApplication;
  let fastifyApp: any;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    userToken = makeToken("USER", "user-1");
    adminToken = makeToken("ADMIN", "admin-1");

    const prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [PackagesController],
      providers: [
        NestPackagesService,
        NestPackagesQuoteService,
        NestPlatformsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.useGlobalFilters(new GlobalHttpExceptionFilter());
    await nestApp.init();

    fastifyApp = await buildServer({
      prisma: prismaMock,
      cache: createCache(),
    });
    await fastifyApp.ready();
  });

  afterAll(async () => {
    await nestApp.close();
    await fastifyApp.close();
  });

  it("GET /api/v1/packages returns identical package list", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/packages")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/packages")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/packages/:id returns identical package details", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/packages/pkg-1")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/packages/pkg-1")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/packages/bundle/templates returns identical bundle templates", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/packages/bundle/templates");

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/packages/bundle/templates");

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/packages/quote returns identical calculation quote", async () => {
    const payload = {
      platform: "instagram",
      handle: "myhandle",
      timezone: "UTC",
      days: 30,
      followersDrip: {
        serviceId: "1042",
        quantity: 1000,
        days: 30,
        intervalHours: 24,
      },
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/packages/quote")
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/packages/quote")
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/packages/:id/comments verifies comments moderation identically", async () => {
    const validPayload = {
      expectedQuantity: 2,
      comments: ["Great photo!", "Nice view!"],
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/packages/pkg-1/comments")
      .set("Authorization", `Bearer ${userToken}`)
      .send(validPayload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/packages/pkg-1/comments")
      .set("Authorization", `Bearer ${userToken}`)
      .send(validPayload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/packages/:id/pause pauses package identically", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/packages/pkg-1/pause")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/packages/pkg-1/pause")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/packages/admin/:id/summary returns identical admin summary", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/packages/admin/pkg-1/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/packages/admin/pkg-1/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });
});
