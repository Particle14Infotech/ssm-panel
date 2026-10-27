import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { UsersController } from "../../api/src/modules/users/users.controller";
import { UsersService as NestUsersService } from "../../api/src/modules/users/users.service";
import { SettingsController } from "../../api/src/modules/settings/settings.controller";
import { SettingsService as NestSettingsService } from "../../api/src/modules/settings/settings.service";
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
  const mockUser = {
    id: "user-1",
    email: "user@test.com",
    name: "Regular User",
    role: "CUSTOMER",
    tier: "STANDARD",
    twoFactorEnabled: false,
    isDeleted: false,
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    wallet: { balance: "500.00" },
  };

  const mockAdmin = {
    id: "admin-1",
    email: "admin@test.com",
    name: "Admin User",
    role: "ADMIN",
    tier: "VIP",
    twoFactorEnabled: true,
    isDeleted: false,
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    wallet: { balance: "10000.00" },
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ ok: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === "user-1") return Promise.resolve(mockUser);
        if (where.id === "admin-1") return Promise.resolve(mockAdmin);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockUser, mockAdmin]),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        return Promise.resolve({ ...mockUser, ...data, id: where.id });
      }),
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

describe("users and admin read-only HTTP contract", () => {
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
      controllers: [UsersController, SettingsController],
      providers: [
        NestUsersService,
        NestSettingsService,
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

  it("matches NestJS for GET /api/v1/users/me with authenticated user", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", userToken)
      .set("X-Request-Id", "profile-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { "x-request-id": "profile-test", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 401 for GET /api/v1/users/me without token", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/users/me")
      .set("X-Request-Id", "unauth-profile");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { "x-request-id": "unauth-profile" },
    });

    expect(fastifyResponse.statusCode).toBe(401);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin list all users", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-users-list");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { "x-request-id": "admin-users-list", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin inspect single user detail", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/users/user-1")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-user-detail");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/users/user-1",
      headers: { "x-request-id": "admin-user-detail", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 404 for non-existent user on GET /api/v1/users/:id", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/users/non-existent-999")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-user-404");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/users/non-existent-999",
      headers: { "x-request-id": "admin-user-404", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(404);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin get settings", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/settings")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "settings-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/settings",
      headers: { "x-request-id": "settings-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS on admin update settings", async () => {
    const payload = { maintenanceMode: true };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/settings")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "settings-update-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: { "x-request-id": "settings-update-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for PUT /api/v1/users/me", async () => {
    const payload = { name: "Updated Name" };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/users/me")
      .set("Authorization", userToken)
      .send(payload)
      .set("X-Request-Id", "update-profile-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/users/me",
      headers: { "x-request-id": "update-profile-test", authorization: userToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for PUT /api/v1/users/:id", async () => {
    const payload = { name: "Admin Edited User", tier: "VIP" };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/users/user-1")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "admin-update-user-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/users/user-1",
      headers: { "x-request-id": "admin-update-user-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for DELETE /api/v1/users/:id (soft delete)", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .delete("/api/v1/users/user-1")
      .set("Authorization", adminToken)
      .set("X-Request-Id", "admin-delete-user-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "DELETE",
      url: "/api/v1/users/user-1",
      headers: { "x-request-id": "admin-delete-user-test", authorization: adminToken },
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for PUT /api/v1/users/:id/status", async () => {
    const payload = { tier: "PRO_SCALE", role: "CUSTOMER" };
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/users/user-1/status")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "admin-status-user-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/users/user-1/status",
      headers: { "x-request-id": "admin-status-user-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(200);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS for POST /api/v1/users/:id/reset-password", async () => {
    const payload = { newPassword: "NewSecretP@ssword2026!" };
    const nestResponse = await request(nestApp.getHttpServer())
      .post("/api/v1/users/user-1/reset-password")
      .set("Authorization", adminToken)
      .send(payload)
      .set("X-Request-Id", "admin-reset-pw-test");

    const fastifyResponse = await fastifyApp.inject({
      method: "POST",
      url: "/api/v1/users/user-1/reset-password",
      headers: { "x-request-id": "admin-reset-pw-test", authorization: adminToken },
      payload,
    });

    expect(fastifyResponse.statusCode).toBe(201);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("RBAC enforcement: CUSTOMER, RESELLER, and SUPPORT are forbidden (403) on admin user routes", async () => {
    const nonAdminRoles = ["CUSTOMER", "RESELLER", "SUPPORT"];
    for (const role of nonAdminRoles) {
      const token = "Bearer " + jwt.sign({ id: `usr-${role.toLowerCase()}`, role }, TEST_SECRET);
      
      const resList = await fastifyApp.inject({
        method: "GET",
        url: "/api/v1/users",
        headers: { authorization: token },
      });
      expect(resList.statusCode).toBe(403);

      const resDelete = await fastifyApp.inject({
        method: "DELETE",
        url: "/api/v1/users/user-1",
        headers: { authorization: token },
      });
      expect(resDelete.statusCode).toBe(403);

      const resReset = await fastifyApp.inject({
        method: "POST",
        url: "/api/v1/users/user-1/reset-password",
        headers: { authorization: token },
        payload: { newPassword: "abc" },
      });
      expect(resReset.statusCode).toBe(403);
    }
  });
});
