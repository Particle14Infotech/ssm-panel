import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { ServicesController } from "../../api/src/modules/services/services.controller";
import { CatalogController } from "../../api/src/modules/services/catalog.controller";
import { ServicesService as NestServicesService } from "../../api/src/modules/services/services.service";
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
  const mockServiceData: any = {
    id: "srv_mock_1",
    name: "Instagram Followers",
    displayName: "Instagram Followers",
    description: "Followers",
    categoryId: "cat_1",
    platform: "INSTAGRAM",
    ratePer1000: "150.00",
    minQty: 100,
    maxQty: 10000,
    avgTime: "10 mins",
    refillable: true,
    cancellable: false,
    dripFeedSupported: false,
    allowManagedDrip: true,
    serviceType: "DEFAULT",
    status: "ACTIVE",
    active: true,
    isDeleted: false,
    category: { id: "cat_1", name: "Instagram", slug: "instagram" },
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    service: {
      findMany: jest.fn().mockResolvedValue([mockServiceData]),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "1042" || where.id === "srv_mock_1") return Promise.resolve(mockServiceData);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockServiceData),
      update: jest.fn().mockResolvedValue(mockServiceData),
    },
    category: {
      findMany: jest.fn().mockResolvedValue([
        { id: "cat_1", name: "Instagram", slug: "instagram", sortOrder: 1, services: [mockServiceData], _count: { services: 1 } },
      ]),
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: "cat_created", ...create })),
    },
    provider: {
      findMany: jest.fn().mockResolvedValue([]),
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

describe("services and catalog HTTP contract", () => {
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
      controllers: [ServicesController, CatalogController],
      providers: [
        NestServicesService,
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
    "/api/v1/services/platforms",
    "/api/v1/services/categories",
    "/api/v1/services/grouped",
    "/api/v1/catalog/grouped",
    "/api/v1/services",
    "/api/v1/services/1042",
  ])("matches NestJS for GET %s", async (path) => {
    const nestResponse = await request(nestApp.getHttpServer()).get(path).set("X-Request-Id", "services-contract");
    const fastifyResponse = await fastifyApp.inject({ method: "GET", url: path, headers: { "x-request-id": "services-contract" } });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS response for unknown service", async () => {
    const nestResponse = await request(nestApp.getHttpServer()).get("/api/v1/services/unknown-9999").set("X-Request-Id", "err-test");
    const fastifyResponse = await fastifyApp.inject({ method: "GET", url: "/api/v1/services/unknown-9999", headers: { "x-request-id": "err-test" } });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.json() ?? {}).toEqual(nestResponse.body);
  });

  it("matches NestJS 401 on admin endpoint without token", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/services/categories")
      .send({ name: "New Category" })
      .set("X-Request-Id", "unauth-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/services/categories",
      headers: { "x-request-id": "unauth-test" },
      payload: { name: "New Category" },
    });

    expect(fastifyResponse.statusCode).toBe(401);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 403 on admin endpoint with non-admin token", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/services/categories")
      .set("Authorization", userToken)
      .send({ name: "New Category" })
      .set("X-Request-Id", "forbidden-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/services/categories",
      headers: { "x-request-id": "forbidden-test", authorization: userToken },
      payload: { name: "New Category" },
    });

    expect(fastifyResponse.statusCode).toBe(403);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 201 on admin createCategory", async () => {
    const payload = { name: "Test Category", slug: "test-category" };
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/services/categories")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "create-cat-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/services/categories",
      headers: { "x-request-id": "create-cat-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(201);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin update service", async () => {
    const payload = { name: "Updated Service Name" };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/services/1042")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "update-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/services/1042",
      headers: { "x-request-id": "update-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin delete service", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .delete("/api/v1/services/1042")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "delete-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "DELETE",
      url: "/api/v1/services/1042",
      headers: { "x-request-id": "delete-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });
});
