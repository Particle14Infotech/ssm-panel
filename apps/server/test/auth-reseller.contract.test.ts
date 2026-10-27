import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import crypto from "crypto";
import { AuthController } from "../../api/src/modules/auth/auth.controller";
import { AuthService as NestAuthService, SANDBOX_AUTH_USERS } from "../../api/src/modules/auth/auth.service";
import { ResellerController } from "../../api/src/modules/reseller/reseller.controller";
import { ResellerService as NestResellerService } from "../../api/src/modules/reseller/reseller.service";
import { ServicesService as NestServicesService } from "../../api/src/modules/services/services.service";
import { OrdersService as NestOrdersService } from "../../api/src/modules/orders/orders.service";
import { WalletService as NestWalletService } from "../../api/src/modules/wallet/wallet.service";
import { EmailService } from "../../api/src/modules/email/email.service";
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
  const mockService: any = {
    id: "1042",
    name: "Instagram Followers",
    displayName: "Instagram Followers",
    platform: "INSTAGRAM",
    ratePer1000: "180.00",
    minQty: 100,
    maxQty: 500000,
    status: "ACTIVE",
    dripFeedSupported: true,
    allowManagedDrip: true,
    isDeleted: false,
  };

  const client: any = {
    isConnected: false, // Sandbox mode for both
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "usr_admin_001", role: "ADMIN", tier: "ENTERPRISE" }),
      create: jest.fn().mockResolvedValue({ id: "usr_test", email: "test@user.com" }),
      update: jest.fn().mockResolvedValue({ id: "usr_test" }),
    },
    session: {
      create: jest.fn().mockResolvedValue({ id: "sess_1" }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: "sess_1" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    service: {
      findMany: jest.fn().mockResolvedValue([mockService]),
      findUnique: jest.fn().mockResolvedValue(mockService),
    },
    order: {
      create: jest.fn().mockResolvedValue({ id: "ord_101", charge: "18.00", status: "PENDING" }),
      findUnique: jest.fn().mockResolvedValue({ id: "ord_101", charge: 18.0, status: "PENDING", startCount: 0, remains: 100 }),
    },
  };

  return Object.assign(client, {
    isConnected: false,
    client,
  });
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "timestamp" && key !== "uptime" && key !== "requestId" && key !== "token" && key !== "refreshToken")
        .map(([key, child]) => [key, normalize(child)])
    );
  }
  return value;
}

describe("Auth & Reseller Routes Contract Parity (Fastify vs NestJS)", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    SANDBOX_AUTH_USERS.clear();
    const prisma = createPrismaMock();
    const cache = createCache();

    const mockEmailService: any = {
      sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
      sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
      sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockOrdersService: any = {
      create: jest.fn().mockResolvedValue({ id: "ord_101" }),
      findOne: jest.fn().mockResolvedValue({ id: "ord_101", charge: 18.0, status: "PENDING", startCount: 0, remains: 100 }),
    };

    const mockWalletService: any = {
      getBalance: jest.fn().mockResolvedValue(14500.0),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, ResellerController],
      providers: [
        NestAuthService,
        NestResellerService,
        NestServicesService,
        { provide: NestOrdersService, useValue: mockOrdersService },
        { provide: NestWalletService, useValue: mockWalletService },
        { provide: EmailService, useValue: mockEmailService },
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

  it("POST /api/v1/auth/login with missing credentials returns identical 401", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/auth/login").send({});
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/auth/login", payload: {} });

    expect(fastifyRes.statusCode).toBe(401);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/auth/register with missing fields returns identical 400", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/auth/register").send({ email: "test@example.com" });
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "test@example.com" } });

    expect(fastifyRes.statusCode).toBe(400);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/auth/forgot-password with missing email returns identical 400", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/auth/forgot-password").send({});
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: {} });

    expect(fastifyRes.statusCode).toBe(400);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/auth/verify-key with invalid header returns identical 401", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/auth/verify-key").set("authorization", "invalid_key");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/auth/verify-key", headers: { authorization: "invalid_key" } });

    expect(fastifyRes.statusCode).toBe(401);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/auth/verify-key with valid bearer returns identical 200 payload", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/auth/verify-key").set("authorization", "Bearer aeth_demo_live_key");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/auth/verify-key", headers: { authorization: "Bearer aeth_demo_live_key" } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/reports returns identical 200 payload", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/reports");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/reports" });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/clients returns identical 200 client list", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/clients");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/clients" });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/pricing returns identical 200 wholesale pricing matrix", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/pricing");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/pricing" });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/v1/services without API key returns identical 401", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/v1/services");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/v1/services" });

    expect(fastifyRes.statusCode).toBe(401);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/v1/services with valid API key returns identical 200 services catalog", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/v1/services").set("x-api-key", "aeth_reseller_key");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/v1/services", headers: { "x-api-key": "aeth_reseller_key" } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/reseller/v1/balance with valid API key returns identical 200 balance", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/reseller/v1/balance").set("x-api-key", "aeth_reseller_key");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/reseller/v1/balance", headers: { "x-api-key": "aeth_reseller_key" } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/reseller/v2 with action=balance returns identical 200 balance", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/reseller/v2").set("x-api-key", "aeth_reseller_key").send({ action: "balance" });
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/reseller/v2", headers: { "x-api-key": "aeth_reseller_key" }, payload: { action: "balance" } });

    expect(fastifyRes.statusCode).toBe(201);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });
});
