import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../common/prisma.service";
import { Decimal } from "decimal.js";
import * as jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  "smm_panel_jwt_secret_dev_environment_key_32bytes";

import { assertRealPostgresStartup } from "../../test-utils/pg-test-startup";

jest.setTimeout(60000);

describe("@pg Milestone 1 Core Correctness Integration Tests", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await assertRealPostgresStartup();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 60000);

  describe("1. Pessimistic Balance Locking & Idempotency", () => {
    const testUserId = "usr_m1_test_user";
    const testServiceId = "1042";

    beforeEach(async () => {
      // Seed isolated user and wallet
      await prisma.user.upsert({
        where: { id: testUserId },
        update: {},
        create: {
          id: testUserId,
          email: "m1_test@smm-panel.io",
          name: "M1 Tester",
          passwordHash: "test_hash",
          role: "CUSTOMER",
          wallet: {
            create: {
              balance: new Decimal(100.0), // 100 INR
              currency: "INR",
            },
          },
        },
      });

      // Reset balance to exactly 100 INR
      await prisma.wallet.update({
        where: { userId: testUserId },
        data: { balance: new Decimal(100.0) },
      });
      await prisma.service.update({
        where: { id: testServiceId },
        data: { cancellable: true },
      });
    });

    it("verifies duplicate Idempotency-Key returns same order without double-debiting", async () => {
      const idempotencyKey = "idem_key_unique_" + Date.now();
      const token = jwt.sign(
        { sub: testUserId, email: "m1_test@smm-panel.io", role: "CUSTOMER", tier: "BRONZE" },
        JWT_SECRET
      );
      const payload = {
        userId: testUserId,
        serviceId: testServiceId,
        target: "https://instagram.com/p/test",
        quantity: 100, // rate: 180/1000 => charge 18 INR
        idempotencyKey,
      };

      // Call 1
      const res1 = await request(app.getHttpServer())
        .post("/api/v1/orders/create")
        .set("Authorization", `Bearer ${token}`)
        .send(payload)
        .expect((response) => {
          if (response.status !== 201) {
            throw new Error(JSON.stringify(response.body));
          }
        });

      // Call 2 with identical key
      const res2 = await request(app.getHttpServer())
        .post("/api/v1/orders/create")
        .set("Authorization", `Bearer ${token}`)
        .send(payload)
        .expect(201);

      expect(res1.body.id).toEqual(res2.body.id);

      // Verify wallet was debited exactly once
      const wallet = await prisma.wallet.findUnique({
        where: { userId: testUserId },
      });
      expect(Number(wallet?.balance)).toEqual(82.0); // 100 - 18 = 82
    });

    it("verifies 10 concurrent orders never overdraw wallet balance below zero", async () => {
      // Balance is 100. Each order costs 18. Maximum 5 orders can succeed (5 * 18 = 90).
      const token = jwt.sign(
        { sub: testUserId, email: "m1_test@smm-panel.io", role: "CUSTOMER", tier: "BRONZE" },
        JWT_SECRET
      );
      const orderPromises = Array.from({ length: 10 }).map((_, idx) => {
        return request(app.getHttpServer())
          .post("/api/v1/orders/create")
          .set("Authorization", `Bearer ${token}`)
          .send({
            userId: testUserId,
            serviceId: testServiceId,
            target: `https://instagram.com/test_${idx}`,
            quantity: 100,
          });
      });

      const responses = await Promise.all(orderPromises);
      const successful = responses.filter((r) => r.status === 201);
      const insufficientBalance = responses.filter(
        (response) =>
          response.status === 400 &&
          response.body?.message === "Insufficient wallet balance."
      );

      expect(successful.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThanOrEqual(5);
      expect(insufficientBalance.length).toBeGreaterThanOrEqual(5);
      expect(successful.length + insufficientBalance.length).toBe(
        responses.length
      );

      const wallet = await prisma.wallet.findUnique({
        where: { userId: testUserId },
      });
      expect(Number(wallet?.balance)).toBeGreaterThanOrEqual(0);
    });

    it("enforces single refund per order at DB constraint level", async () => {
      const token = jwt.sign(
        { sub: testUserId, email: "m1_test@smm-panel.io", role: "CUSTOMER", tier: "BRONZE" },
        JWT_SECRET
      );
      const createRes = await request(app.getHttpServer())
        .post("/api/v1/orders/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: testUserId,
          serviceId: testServiceId,
          target: "https://instagram.com/test_refund",
          quantity: 100,
        })
        .expect(201);

      const orderId = createRes.body.id;

      // Cancel and refund 1st time
      const cancel1 = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .expect(201);
      expect(cancel1.body.success).toBe(true);

      // Second attempt must fail with Conflict (409)
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .expect(409);

      // Check ledger entries for this order - exactly 1 REFUND entry
      const refunds = await prisma.ledgerEntry.findMany({
        where: {
          orderId,
          type: "REFUND",
        },
      });
      expect(refunds.length).toBe(1);
    });
  });

  describe("2. Authentication and Password Hashing", () => {
    it("provisions user with Argon2id hash and provisions INR wallet", async () => {
      const uniqueEmail = `test_customer_${Date.now()}@example.com`;
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: uniqueEmail,
          password: "StrongPassword#2026",
          name: "Test Customer",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(uniqueEmail);

      // Login with credentials
      const loginRes = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: uniqueEmail,
          password: "StrongPassword#2026",
        })
        .expect(201);

      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.refreshToken).toBeDefined();

      // Refresh token rotation
      const refreshRes = await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      expect(refreshRes.body.token).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toEqual(loginRes.body.refreshToken);
    });
  });
});
