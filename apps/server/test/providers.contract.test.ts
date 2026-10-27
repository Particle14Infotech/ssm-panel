import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ProvidersController } from "../../api/src/modules/providers/providers.controller";
import { ProvidersService as NestProvidersService } from "../../api/src/modules/providers/providers.service";
import { SmmProviderClient } from "../../api/src/modules/providers/smm-provider.client";
import { PrismaService } from "../../api/src/common/prisma.service";
import { GlobalHttpExceptionFilter } from "../../api/src/common/http-exception.filter";
import { buildServer } from "../src/app";
import { PrismaLike } from "../src/prisma";
import { CacheLike } from "../src/cache";
import { encryptProviderKey } from "../src/crypto.util";

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
  const mockProvider: any = {
    id: "prov-1",
    name: "Main Wholesaler",
    apiUrl: "https://api.smm-mock.com/api/v2",
    apiKeyEncrypted: encryptProviderKey("test_secret_api_key_1234"),
    balance: "5000.00",
    currency: "INR",
    active: true,
    consecutiveStatusFailures: 0,
    lastStatusCheckAt: new Date("2026-10-27T00:00:00.000Z"),
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
    _count: { services: 5 },
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    provider: {
      findMany: jest.fn().mockResolvedValue([mockProvider]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "prov-1") return Promise.resolve(mockProvider);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockProvider),
      update: jest.fn().mockResolvedValue(mockProvider),
      delete: jest.fn().mockResolvedValue(mockProvider),
    },
    service: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "svc-1") return Promise.resolve({ id: "svc-1", allowManagedDrip: true });
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({ id: "svc-1", allowManagedDrip: true }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
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

describe("Providers Routes Contract Parity (Fastify vs NestJS)", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;
  const adminToken = makeToken("ADMIN", "admin-1");
  const customerToken = makeToken("CUSTOMER", "user-1");

  beforeAll(async () => {
    const prisma = createPrismaMock();
    const cache = createCache();
    const mockSmmClient: any = {
      getBalance: jest.fn().mockResolvedValue({ balance: 5000.0, currency: "INR" }),
      getServices: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProvidersController],
      providers: [
        NestProvidersService,
        { provide: SmmProviderClient, useValue: mockSmmClient },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.useGlobalFilters(new GlobalHttpExceptionFilter());
    await nestApp.init();

    fastifyApp = await buildServer({ cache, prisma, smmClient: mockSmmClient });
    await fastifyApp.ready();
  });

  afterAll(async () => {
    await nestApp.close();
    await fastifyApp.close();
  });

  it("GET /api/v1/providers without token returns identical 401", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/providers");
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/providers" });

    expect(fastifyRes.statusCode).toBe(401);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/providers with CUSTOMER token returns identical 403", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/providers").set("authorization", `Bearer ${customerToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/providers", headers: { authorization: `Bearer ${customerToken}` } });

    expect(fastifyRes.statusCode).toBe(403);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/providers with ADMIN token returns identical 200 list", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/providers").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/providers", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/providers with missing body returns identical 400", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/providers").set("authorization", `Bearer ${adminToken}`).send({});
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/providers", headers: { authorization: `Bearer ${adminToken}` }, payload: {} });

    expect(fastifyRes.statusCode).toBe(400);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/providers with valid body returns identical 201", async () => {
    const payload = { name: "New Provider", apiUrl: "https://api.test.com", apiKey: "secret_12345" };
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/providers").set("authorization", `Bearer ${adminToken}`).send(payload);
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/providers", headers: { authorization: `Bearer ${adminToken}` }, payload });

    expect(fastifyRes.statusCode).toBe(201);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/providers/prov-1 returns identical 200 provider detail", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/providers/prov-1").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/providers/prov-1", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/providers/non-existent returns identical 404", async () => {
    const nestRes = await request(nestApp.getHttpServer()).get("/api/v1/providers/non-existent-999").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "GET", url: "/api/v1/providers/non-existent-999", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(404);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("DELETE /api/v1/providers/prov-1 returns identical 200 deleted message", async () => {
    const nestRes = await request(nestApp.getHttpServer()).delete("/api/v1/providers/prov-1").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "DELETE", url: "/api/v1/providers/prov-1", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(200);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/providers/prov-1/sync returns identical 201 sync stats", async () => {
    const nestRes = await request(nestApp.getHttpServer()).post("/api/v1/providers/prov-1/sync").set("authorization", `Bearer ${adminToken}`);
    const fastifyRes = await fastifyApp.inject({ method: "POST", url: "/api/v1/providers/prov-1/sync", headers: { authorization: `Bearer ${adminToken}` } });

    expect(fastifyRes.statusCode).toBe(201);
    expect(fastifyRes.statusCode).toBe(nestRes.status);
    expect(normalize(fastifyRes.json())).toEqual(normalize(nestRes.body));
  });
});
