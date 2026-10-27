import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PricingController } from "../../api/src/modules/pricing/pricing.controller";
import { PricingService as NestPricingService } from "../../api/src/modules/pricing/pricing.service";
import { CouponsController } from "../../api/src/modules/coupons/coupons.controller";
import { CouponsService as NestCouponsService } from "../../api/src/modules/coupons/coupons.service";
import { AnnouncementsController } from "../../api/src/modules/announcements/announcements.controller";
import { AnnouncementsService as NestAnnouncementsService } from "../../api/src/modules/announcements/announcements.service";
import { ReportsController } from "../../api/src/modules/reports/reports.controller";
import { ReportsService as NestReportsService } from "../../api/src/modules/reports/reports.service";
import { EmailController } from "../../api/src/modules/email/email.controller";
import { EmailService as NestEmailService } from "../../api/src/modules/email/email.service";
import { SMMCacheService } from "../../api/src/common/cache.service";
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

function makeToken(role: string, id = "user-1") {
  return jwt.sign({ sub: id, id, email: `${role.toLowerCase()}@test.com`, role }, TEST_SECRET, { expiresIn: "1h" });
}

function createPrismaMock(): PrismaLike {
  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ key: "PRICING_CONFIG", value: {} }),
    },
    service: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    emailLog: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    emailDailyCounter: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    emailSuppression: {
      upsert: jest.fn().mockResolvedValue({}),
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
        .filter(([k]) => !["requestId", "timestamp", "createdAt", "fileName"].includes(k))
        .map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

describe("Remaining Modules contract parity (NestJS vs Fastify)", () => {
  let nestApp: INestApplication;
  let fastifyApp: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    adminToken = makeToken("ADMIN", "admin-1");
    userToken = makeToken("USER", "user-1");

    const prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [
        PricingController,
        CouponsController,
        AnnouncementsController,
        ReportsController,
        EmailController,
      ],
      providers: [
        NestPricingService,
        NestCouponsService,
        NestAnnouncementsService,
        NestReportsService,
        NestEmailService,
        SMMCacheService,
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

  it("GET /api/v1/admin/pricing/settings returns identical settings", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/pricing/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/admin/pricing/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/admin/pricing/what-if simulates identically", async () => {
    const payload = { costINR: 100, quantity: 1000 };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/admin/pricing/what-if")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/admin/pricing/what-if")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/admin/profit/summary returns identical summary", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/profit/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/admin/profit/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/coupons returns identical coupons list", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/coupons");

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/coupons");

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/coupons/apply applies coupon identically", async () => {
    const payload = { code: "WELCOME10", orderAmount: 500 };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/coupons/apply")
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/coupons/apply")
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/bonuses returns identical bonus tiers", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/bonuses");

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/bonuses");

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/announcements returns active announcements", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/announcements");

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/announcements");

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reports/summary returns analytics summary", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/reports/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/reports/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reports/export-csv returns CSV report payload", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/reports/export-csv")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/reports/export-csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/admin/email/telemetry returns telemetry status", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/admin/email/telemetry")
      .set("Authorization", `Bearer ${adminToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/admin/email/telemetry")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(fastifyRes.body.dailyQuota.limit).toBe(nestRes.body.dailyQuota.limit);
    expect(fastifyRes.body.stats).toEqual(nestRes.body.stats);
  });
});
