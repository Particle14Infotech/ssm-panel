import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import jwt from "jsonwebtoken";
import { WalletController } from "../../api/src/modules/wallet/wallet.controller";
import { WalletService as NestWalletService } from "../../api/src/modules/wallet/wallet.service";
import { PaymentsController } from "../../api/src/modules/payments/payments.controller";
import { PaymentsService as NestPaymentsService } from "../../api/src/modules/payments/payments.service";
import { SimulatedPaymentProvider } from "../../api/src/modules/payments/simulated-payment.provider";
import { RazorpayPaymentProvider } from "../../api/src/modules/payments/razorpay-payment.provider";
import { PrismaService } from "../../api/src/common/prisma.service";
import { GlobalHttpExceptionFilter } from "../../api/src/common/http-exception.filter";
import { buildServer } from "../src/app";
import { PrismaLike } from "../src/prisma";
import { CacheLike } from "../src/cache";
import { Decimal } from "decimal.js";

const TEST_SECRET = "test-jwt-access-secret-32-characters-long!";
process.env.JWT_ACCESS_SECRET = TEST_SECRET;
process.env.JWT_SECRET = TEST_SECRET;
process.env.NODE_ENV = "test";
process.env.DISABLE_RATE_LIMITER = "true";
process.env.PAYMENT_PROVIDER = "simulated";

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
  const mockWallet = {
    id: "wal-1",
    userId: "user-1",
    balance: new Decimal(2500.0),
    currency: "INR",
    ledger: [
      {
        id: "led-1",
        walletId: "wal-1",
        amount: new Decimal(2500.0),
        type: "DEPOSIT",
        orderId: null,
        referenceId: "pay_test_1",
        description: "Initial deposit",
        createdAt: new Date("2026-10-27T00:00:00.000Z"),
      },
    ],
  };

  const mockPayment = {
    id: "pay-1",
    userId: "user-1",
    gatewayOrderId: "order_test_1",
    amount: new Decimal(500.0),
    bonusAmount: new Decimal(25.0),
    method: "UPI",
    status: "PENDING",
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
    updatedAt: new Date("2026-10-27T00:00:00.000Z"),
  };

  const client: any = {
    isConnected: true,
    $queryRawUnsafe: jest.fn().mockResolvedValue([
      { id: "wal-1", balance: "2500.00", currency: "INR" },
    ]),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === "function") return cb(client);
      return Promise.all(cb);
    }),
    wallet: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.userId === "user-1") return Promise.resolve(mockWallet);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockWallet),
      update: jest.fn().mockResolvedValue(mockWallet),
    },
    ledgerEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockWallet.ledger[0]),
    },
    payment: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.gatewayOrderId === "order_test_1") return Promise.resolve(mockPayment);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockPayment]),
      create: jest.fn().mockResolvedValue(mockPayment),
      update: jest.fn().mockResolvedValue({ ...mockPayment, status: "SUCCESS" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        .filter(([k]) => !["requestId", "timestamp", "depositId", "referenceId", "receipt", "orderId", "gatewayOrderId", "paymentId"].includes(k))
        .map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

describe("Wallet and Payments contract parity (NestJS vs Fastify)", () => {
  let nestApp: INestApplication;
  let fastifyApp: any;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    userToken = makeToken("USER", "user-1");
    adminToken = makeToken("ADMIN", "admin-1");

    const prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController, PaymentsController],
      providers: [
        NestWalletService,
        NestPaymentsService,
        SimulatedPaymentProvider,
        RazorpayPaymentProvider,
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

  it("GET /api/v1/wallet/balance returns identical liquid balance", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/wallet/balance")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/wallet/balance")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/wallet/ledger returns identical ledger entries", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/wallet/ledger")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/wallet/ledger")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/wallet/adjust executes admin adjustment identically", async () => {
    const payload = {
      userId: "user-1",
      amount: 150.0,
      reason: "Loyalty reward bonus",
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/wallet/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/wallet/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/wallet/adjust rejects missing reason identically with 400", async () => {
    const payload = {
      userId: "user-1",
      amount: 100.0,
      reason: "",
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/wallet/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/wallet/adjust")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(400);
    expect(fastifyRes.body.code).toBe(nestRes.body.code);
  });

  it("POST /api/v1/wallet/deposit handles sandbox deposit identically", async () => {
    const payload = {
      amount: 1000,
      method: "UPI",
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/wallet/deposit")
      .set("Authorization", `Bearer ${userToken}`)
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/wallet/deposit")
      .set("Authorization", `Bearer ${userToken}`)
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("POST /api/v1/payments/create-order creates payment order identically", async () => {
    const payload = {
      amount: 1000,
      idempotencyKey: "idem_pay_1",
    };

    const nestRes = await request(nestApp.getHttpServer())
      .post("/api/v1/payments/create-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send(payload);

    const fastifyRes = await request(fastifyApp.server)
      .post("/api/v1/payments/create-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send(payload);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(201);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });

  it("GET /api/v1/payments returns payments list identically", async () => {
    const nestRes = await request(nestApp.getHttpServer())
      .get("/api/v1/payments")
      .set("Authorization", `Bearer ${userToken}`);

    const fastifyRes = await request(fastifyApp.server)
      .get("/api/v1/payments")
      .set("Authorization", `Bearer ${userToken}`);

    expect(fastifyRes.status).toBe(nestRes.status);
    expect(fastifyRes.status).toBe(200);
    expect(normalize(fastifyRes.body)).toEqual(normalize(nestRes.body));
  });
});
