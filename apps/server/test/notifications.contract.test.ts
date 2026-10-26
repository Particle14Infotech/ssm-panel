import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { NotificationsController } from "../../api/src/modules/notifications/notifications.controller";
import { NotificationsService as NestNotificationsService } from "../../api/src/modules/notifications/notifications.service";
import { GlobalHttpExceptionFilter } from "../../api/src/common/http-exception.filter";
import { buildServer } from "../src/app";
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

describe("notifications HTTP contract", () => {
  let nestApp: INestApplication;
  let fastifyApp: Awaited<ReturnType<typeof buildServer>>;
  let userToken: string;

  beforeAll(async () => {
    userToken = "Bearer " + jwt.sign({ id: "user-1", email: "user@test.com", role: "CUSTOMER" }, TEST_SECRET);

    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [NestNotificationsService],
    }).compile();

    nestApp = module.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    nestApp.useGlobalFilters(new GlobalHttpExceptionFilter());
    nestApp.use((req: any, res: any, next: () => void) => {
      res.setHeader("X-Request-Id", req.headers["x-request-id"] || "req_test");
      next();
    });
    await nestApp.init();

    fastifyApp = await buildServer({ cache: createCache() });
  });

  afterAll(async () => {
    await fastifyApp.close();
    await nestApp.close();
  });

  it("matches NestJS for GET /api/v1/notifications", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", userToken)
      .set("X-Request-Id", "notif-list");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { "x-request-id": "notif-list", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(fastifyResponse.headers["x-request-id"]).toBe(nestResponse.headers["x-request-id"]);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 401 for GET /api/v1/notifications without auth", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .get("/api/v1/notifications")
      .set("X-Request-Id", "notif-unauth");

    const fastifyResponse = await fastifyApp.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { "x-request-id": "notif-unauth" },
    });

    expect(fastifyResponse.statusCode).toBe(401);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });

  it("matches NestJS 404 when marking non-existent notification as read", async () => {
    const nestResponse = await request(nestApp.getHttpServer())
      .put("/api/v1/notifications/non-existent-1/read")
      .set("Authorization", userToken)
      .set("X-Request-Id", "notif-404");

    const fastifyResponse = await fastifyApp.inject({
      method: "PUT",
      url: "/api/v1/notifications/non-existent-1/read",
      headers: { "x-request-id": "notif-404", authorization: userToken },
    });

    expect(fastifyResponse.statusCode).toBe(404);
    expect(fastifyResponse.statusCode).toBe(nestResponse.statusCode);
    expect(normalize(fastifyResponse.json())).toEqual(normalize(nestResponse.body));
  });
});
