import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { HealthCheckService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { HealthController } from "../../api/src/modules/health/health.controller";
import { SMMCacheService } from "../../api/src/common/cache.service";
import { PrismaService } from "../../api/src/common/prisma.service";
import { buildServer } from "../src/app";
import { CacheLike } from "../src/cache";
import { PrismaLike } from "../src/prisma";

const fixedDate = new Date("2026-10-27T00:00:00.000Z");

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

function createPrisma(): PrismaLike {
  const client: any = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    outboxEvent: {
      count: jest.fn().mockResolvedValue(2),
      findFirst: jest.fn().mockResolvedValue({ id: "outbox-1", attempts: 3, updatedAt: fixedDate }),
    },
    orderStatusHistory: { findFirst: jest.fn().mockResolvedValue({ createdAt: fixedDate }) },
    order: { findFirst: jest.fn().mockResolvedValue({ id: "order-1", status: "PROCESSING", providerOrderId: "provider-1", updatedAt: fixedDate }) },
    provider: {
      findMany: jest.fn().mockResolvedValue([{ id: "provider-1", name: "Primary", balance: "12.34", currency: "INR", active: true, updatedAt: fixedDate, _count: { services: 5 } }]),
    },
    service: { findFirst: jest.fn().mockResolvedValue({ updatedAt: fixedDate }) },
    emailDailyCounter: { findUnique: jest.fn().mockResolvedValue({ count: 8 }) },
    emailLog: {
      count: jest.fn().mockResolvedValue(4),
      findFirst: jest.fn().mockResolvedValue({ id: "email-1", to: "person@example.test", type: "ORDER", status: "SENT", providerMessageId: "message-1", error: null, createdAt: fixedDate }),
    },
    emailSuppression: { count: jest.fn().mockResolvedValue(0) },
    orderRun: { count: jest.fn().mockResolvedValue(0) },
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
        .filter(([key]) => key !== "timestamp" && key !== "uptime")
        .map(([key, child]) => [key, normalize(child)])
    );
  }
  return value;
}

describe("health HTTP contract", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DISABLE_RATE_LIMITER = "true";
    const nestPrisma = createPrisma();
    const nestCache = createCache();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: {} },
        { provide: PrismaService, useValue: nestPrisma },
        { provide: SMMCacheService, useValue: nestCache },
      ],
    }).compile();
    nestApp = module.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.use((requestLike: any, responseLike: any, next: () => void) => {
      responseLike.setHeader("X-Request-Id", requestLike.headers["x-request-id"] || "generated-id");
      next();
    });
    await nestApp.init();
    fastifyApp = await buildServer({ prisma: createPrisma(), cache: createCache() });
  });

  afterAll(async () => {
    await fastifyApp.close();
    await nestApp.close();
  });

  it.each(["/api/v1/health/live", "/api/v1/health/ready", "/api/v1/health/system"])("matches NestJS for %s", async (path) => {
    const nestResponse = await request(nestApp.getHttpServer()).get(path).set("X-Request-Id", "health-contract");
    const fastifyResponse = await fastifyApp.inject({ method: "GET", url: path, headers: { "x-request-id": "health-contract" } });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["content-type"]).toBe(nestResponse.headers["content-type"]);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });
});
