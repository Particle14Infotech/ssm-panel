import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { TicketsController } from "../../api/src/modules/tickets/tickets.controller";
import { TicketsService as NestTicketsService } from "../../api/src/modules/tickets/tickets.service";
import { FavoritesController } from "../../api/src/modules/favorites/favorites.controller";
import { FavoritesService as NestFavoritesService } from "../../api/src/modules/favorites/favorites.service";
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
  const mockTicket: any = {
    id: "ticket-1",
    userId: "user-1",
    subject: "Need Help",
    priority: "NORMAL",
    status: "OPEN",
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
    messages: [
      { id: "msg-1", ticketId: "ticket-1", senderId: "user-1", message: "Help please", createdAt: new Date("2026-10-27T00:00:00.000Z") },
    ],
  };

  const mockFavorite: any = {
    id: "fav-1",
    userId: "user-1",
    serviceId: "1042",
    customName: "My Followers",
    targetUrl: "https://instagram.com/profile",
    defaultQuantity: 100,
    isDripFeed: false,
    dripRuns: null,
    dripInterval: null,
    comments: null,
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
    service: {
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
    },
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") {
        return cb(client);
      }
      return Promise.all(cb);
    }),
    ticket: {
      findMany: jest.fn().mockResolvedValue([mockTicket]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "ticket-1") return Promise.resolve(mockTicket);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockTicket),
      update: jest.fn().mockResolvedValue(mockTicket),
    },
    ticketMessage: {
      create: jest.fn().mockResolvedValue({ id: "msg-2", ticketId: "ticket-1", senderId: "user-1", message: "Reply", createdAt: new Date("2026-10-27T00:00:00.000Z") }),
    },
    favorite: {
      findMany: jest.fn().mockResolvedValue([mockFavorite]),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "fav-1") return Promise.resolve(mockFavorite);
        return Promise.resolve(null);
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
      upsert: jest.fn().mockResolvedValue(mockFavorite),
      delete: jest.fn().mockResolvedValue(mockFavorite),
    },
    service: {
      findUnique: jest.fn().mockResolvedValue({ id: "1042", isDeleted: false }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    suggestionDismissal: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "user-1", email: "user@test.com" }),
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

describe("tickets and favorites HTTP contract", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    adminToken = "Bearer " + jwt.sign({ id: "admin-1", email: "admin@test.com", role: "ADMIN" }, TEST_SECRET);
    userToken = "Bearer " + jwt.sign({ id: "user-1", email: "user@test.com", role: "CUSTOMER" }, TEST_SECRET);

    const prismaMock = createPrismaMock();
    const cacheMock = createCache();

    const module = await Test.createTestingModule({
      controllers: [TicketsController, FavoritesController],
      providers: [
        NestTicketsService,
        NestFavoritesService,
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

  it("matches NestJS for GET /api/v1/tickets", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", userToken)
      .set("X-Request-Id", "ticket-list");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/tickets",
      headers: { "x-request-id": "ticket-list", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 401 for GET /api/v1/tickets without auth", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/tickets")
      .set("X-Request-Id", "ticket-unauth");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/tickets",
      headers: { "x-request-id": "ticket-unauth" },
    });

    expect(fastifyResponse.statusCode).toBe(401);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for POST /api/v1/tickets", async () => {
    const payload = { subject: "Issue with order", message: "Help", priority: "NORMAL" };
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", userToken)
      .send(payload)
      .set("X-Request-Id", "create-ticket");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/tickets",
      headers: { "x-request-id": "create-ticket", authorization: userToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(201);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for GET /api/v1/tickets/:id", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/tickets/ticket-1")
      .set("Authorization", userToken)
      .set("X-Request-Id", "get-ticket");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/tickets/ticket-1",
      headers: { "x-request-id": "get-ticket", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 404 for GET /api/v1/tickets/:id with unknown ticket", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/tickets/unknown-999")
      .set("Authorization", userToken)
      .set("X-Request-Id", "ticket-404");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/tickets/unknown-999",
      headers: { "x-request-id": "ticket-404", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(404);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for GET /api/v1/favorites", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/favorites")
      .set("Authorization", userToken)
      .set("X-Request-Id", "fav-list");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/favorites",
      headers: { "x-request-id": "fav-list", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for POST /api/v1/favorites", async () => {
    const payload = {
      serviceId: "1042",
      targetUrl: "https://instagram.com/profile",
      defaultQuantity: 100,
    };
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/favorites")
      .set("Authorization", userToken)
      .send(payload)
      .set("X-Request-Id", "create-fav");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/favorites",
      headers: { "x-request-id": "create-fav", authorization: userToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(201);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for DELETE /api/v1/favorites/:id", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .delete("/api/v1/favorites/fav-1")
      .set("Authorization", userToken)
      .set("X-Request-Id", "del-fav");

    const fastifyResponse = await fastifyApp.inject({
      method: "DELETE",
      url: "/api/v1/favorites/fav-1",
      headers: { "x-request-id": "del-fav", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for GET /api/v1/favorites/suggestions", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/favorites/suggestions")
      .set("Authorization", userToken)
      .set("X-Request-Id", "fav-suggestions");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/favorites/suggestions",
      headers: { "x-request-id": "fav-suggestions", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });
});
