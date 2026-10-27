import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { OrdersController } from "../../api/src/modules/orders/orders.controller";
import { OrdersService as NestOrdersService } from "../../api/src/modules/orders/orders.service";
import { SettingsService as NestSettingsService } from "../../api/src/modules/settings/settings.service";
import { PricingService as NestPricingService } from "../../api/src/modules/pricing/pricing.service";
import { WalletService } from "../../api/src/modules/wallet/wallet.service";
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
  const mockOrder: any = {
    id: "ord-1",
    userId: "user-1",
    serviceId: "1042",
    target: "https://instagram.com/my-profile",
    quantity: 100,
    isDripFeed: false,
    dripMode: "NONE",
    runs: null,
    intervalMinutes: null,
    quantityPerRun: 100,
    totalQuantity: 100,
    charge: "18.00",
    sellRatePer1k: "180.00",
    costRatePer1k: "120.00",
    fxRateUsed: "1.00",
    providerCurrency: "INR",
    dripSurchargePercent: "0.00",
    estimatedProviderCost: "12.00",
    estimatedGrossProfit: "6.00",
    paymentFeeEstimate: "0.36",
    estimatedNetProfit: "5.64",
    status: "PENDING",
    providerId: "prov-1",
    providerOrderId: "ext-101",
    startCount: 0,
    remains: 100,
    idempotencyKey: null,
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
    service: {
      id: "1042",
      name: "Instagram Followers",
      platform: "INSTAGRAM",
      refillable: true,
      cancellable: true,
    },
    history: [
      { id: "hist-1", orderId: "ord-1", status: "PENDING", notes: "Placed", createdAt: new Date("2026-10-27T00:00:00.000Z") },
    ],
    refunds: [],
    runsList: [],
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    order: {
      findMany: jest.fn().mockResolvedValue([mockOrder]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "ord-1") return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockOrder),
      update: jest.fn().mockResolvedValue(mockOrder),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: "hist-2", orderId: "ord-1", notes: "Note" }),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: "evt-1" }),
    },
    service: {
      findUnique: jest.fn().mockResolvedValue({
        id: "1042",
        name: "Instagram Followers",
        displayName: "Instagram Followers",
        platform: "INSTAGRAM",
        ratePer1000: "180.00",
        minQty: 10,
        maxQty: 100000,
        status: "ACTIVE",
        active: true,
        isDeleted: false,
        refillable: true,
        cancellable: true,
      }),
    },
    ticket: {
      create: jest.fn().mockResolvedValue({ id: "tkt-1", subject: "Problem Report", status: "OPEN" }),
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

describe("Orders Routes Contract Parity (Fastify vs NestJS)", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;
  const adminToken = makeToken("ADMIN", "admin-1");
  const customerToken = makeToken("CUSTOMER", "user-1");

  beforeAll(async () => {
    const prisma = createPrismaMock();
    const cache = createCache();
    const mockWalletService: any = {
      getBalance: jest.fn().mockResolvedValue(1000.0),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        NestOrdersService,
        NestSettingsService,
        NestPricingService,
        { provide: WalletService, useValue: mockWalletService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.useGlobalFilters(new GlobalHttpExceptionFilter());
    await nestApp.init();

    fastifyApp = await buildServer({ cache, prisma });
    await fastifyApp.ready();
  });

  afterAll(async () => {
    await nestApp.close();
    await fastifyApp.close();
  });

  it("GET /api/v1/orders without token returns identical 401", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/orders");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/orders" });

    expect(fastifyRes.statusCode).toBe(401);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/orders with customer token returns identical 200 orders stream", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/orders").set("authorization", `Bearer ${customerToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/orders", headers: { authorization: `Bearer ${customerToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/orders with admin token returns identical 200 orders stream", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/orders").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/orders", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/orders/non-existent-order returns identical 404", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/orders/non-existent-order").set("authorization", `Bearer ${customerToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/orders/non-existent-order", headers: { authorization: `Bearer ${customerToken}` } });

    expect(fastifyRes.statusCode).toBe(404);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/orders/ord-1 returns identical 200 order detail", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/orders/ord-1").set("authorization", `Bearer ${customerToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/orders/ord-1", headers: { authorization: `Bearer ${customerToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/orders/:id/report-problem returns identical 201 result", async () => {
    const payload = { issueType: "DROP", notes: "Followers dropped" };
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/orders/ord-1/report-problem").set("authorization", `Bearer ${customerToken}`).send(payload);
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/orders/ord-1/report-problem", headers: { authorization: `Bearer ${customerToken}` }, payload });

    expect(fastifyRes.statusCode).toBe(201);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(fastifyRes.json().success).toBe(nestRes.body.success);
    expect(fastifyRes.json().message).toBe(nestRes.body.message);
  });

  it("POST /api/v1/orders/:id/refill returns identical 201 result", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/orders/ord-1/refill").set("authorization", `Bearer ${customerToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/orders/ord-1/refill", headers: { authorization: `Bearer ${customerToken}` } });

    expect(fastifyRes.statusCode).toBe(201);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("PUT /api/v1/orders/:id/notes with admin token returns identical 200 result", async () => {
    const payload = { notes: "Customer verified on Instagram" };
    const nestRes = await request(nestApp.getHttpServer()).put("/api/v1/orders/ord-1/notes").set("authorization", `Bearer ${adminToken}`).send(payload);
    const fastifyRes = await fastifyApp.inject({ method: "PUT", url: "/api/v1/orders/ord-1/notes", headers: { authorization: `Bearer ${adminToken}` }, payload });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });
});
