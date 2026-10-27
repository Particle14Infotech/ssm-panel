import crypto from "crypto";
import { buildServer } from "../src/app";
import { PaymentsService } from "../src/services/payments.service";
import { WalletService } from "../src/services/wallet.service";
import { RazorpayPaymentProvider } from "../src/services/razorpay-payment.provider";
import { Decimal } from "decimal.js";
import { PrismaLike } from "../src/prisma";

describe("P1: Razorpay Webhooks and Money Flows", () => {
  const WEBHOOK_SECRET = "test_webhook_secret_key_32bytes!";
  const KEY_ID = "rzp_test_12345678";
  const KEY_SECRET = "rzp_secret_87654321";

  let app: any;
  let ledgerEntries: any[] = [];
  let walletBalance = new Decimal(1000.0);
  let mockPrisma: PrismaLike;
  let paymentsService: PaymentsService;
  let razorpayProvider: RazorpayPaymentProvider;

  beforeEach(async () => {
    ledgerEntries = [
      {
        id: "led-init",
        walletId: "wal-1",
        amount: new Decimal(1000.0),
        type: "DEPOSIT",
        referenceId: "init-ref",
        idempotencyKey: "init-key",
        description: "Initial Balance",
      },
    ];
    walletBalance = new Decimal(1000.0);

    const client: any = {
      isConnected: true,
      $queryRawUnsafe: jest.fn().mockImplementation(async (_query: string, _userId: string) => {
        return [{ id: "wal-1", balance: walletBalance.toString(), currency: "INR" }];
      }),
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(client);
      }),
      wallet: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.userId === "user-test-1") {
            return { id: "wal-1", userId: "user-test-1", balance: walletBalance, currency: "INR" };
          }
          return null;
        }),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          walletBalance = new Decimal(data.balance.toString());
          return { id: "wal-1", userId: "user-test-1", balance: walletBalance, currency: "INR" };
        }),
      },
      ledgerEntry: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          return ledgerEntries.find((e) => e.referenceId === where.referenceId) || null;
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const entry = { id: `led-${Date.now()}-${Math.random()}`, ...data };
          ledgerEntries.push(entry);
          return entry;
        }),
      },
      payment: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.gatewayOrderId === "order_rzp_test_1") {
            return {
              id: "pay-rzp-1",
              userId: "user-test-1",
              gatewayOrderId: "order_rzp_test_1",
              amount: new Decimal(500.0),
              bonusAmount: new Decimal(25.0),
              status: "PENDING",
            };
          }
          return null;
        }),
        update: jest.fn().mockResolvedValue({ id: "pay-rzp-1", status: "SUCCESS" }),
      },
    };

    mockPrisma = {
      isConnected: true,
      client,
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const walletService = new WalletService(mockPrisma);
    razorpayProvider = new RazorpayPaymentProvider();
    razorpayProvider.setCredentials(KEY_ID, KEY_SECRET, WEBHOOK_SECRET);

    paymentsService = new PaymentsService(
      mockPrisma,
      walletService,
      undefined,
      razorpayProvider
    );

    app = await buildServer({
      prisma: mockPrisma,
      paymentsService,
    });
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  function signPayload(bodyBuffer: Buffer, secret = WEBHOOK_SECRET): string {
    return crypto.createHmac("sha256", secret).update(bodyBuffer).digest("hex");
  }

  test("1. Valid signature verifies successfully and credits wallet atomically", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    const payload = {
      event_id: "evt_valid_1",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_valid_123",
            order_id: "order_rzp_test_1",
            amount: 50000,
            method: "UPI",
          },
        },
      },
    };
    const rawBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = signPayload(rawBytes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: rawBytes,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);

    // Initial 1000 + 500 deposit + 25 bonus = 1525
    expect(walletBalance.toNumber()).toBe(1525);
    const ledgerSum = ledgerEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));
    expect(ledgerSum.toNumber()).toBe(walletBalance.toNumber());
  });

  test("2. Tampered body is rejected with 400 Bad Request", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    const payload = {
      event_id: "evt_tampered_1",
      event: "payment.captured",
      amount: 50000,
    };
    const rawBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = signPayload(rawBytes);

    // Tamper payload after signing
    const tamperedBytes = Buffer.from(JSON.stringify({ ...payload, amount: 999999 }), "utf8");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: tamperedBytes,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
    expect(res.json().message).toContain("Invalid Razorpay webhook signature");
  });

  test("3. Wrong secret is rejected with 400 Bad Request", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    const payload = { event_id: "evt_secret_1", event: "payment.captured" };
    const rawBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = signPayload(rawBytes, "wrong_secret_key_abcdef1234567890!");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: rawBytes,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Invalid Razorpay webhook signature");
  });

  test("4. Key-reordered JSON verifies correctly against raw body bytes", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    // Construct raw bytes with specific field order and formatting
    const rawString = '{"b_param":2,"a_param":1,"event_id":"evt_reordered_1","event":"payment.captured"}';
    const rawBytes = Buffer.from(rawString, "utf8");
    const signature = signPayload(rawBytes);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: rawBytes,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  test("5. Duplicate event id is handled idempotently and credited only once", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    const payload = {
      event_id: "evt_duplicate_test_100",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup_999",
            order_id: "order_rzp_test_1",
            amount: 50000,
          },
        },
      },
    };
    const rawBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = signPayload(rawBytes);

    // First delivery
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: rawBytes,
    });
    expect(res1.statusCode).toBe(201);
    const balanceAfterFirst = walletBalance.toNumber();

    // Second delivery (duplicate retry)
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      payload: rawBytes,
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().duplicate).toBe(true);

    // Balance and ledger unchanged after duplicate
    expect(walletBalance.toNumber()).toBe(balanceAfterFirst);
    const ledgerSum = ledgerEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));
    expect(ledgerSum.toNumber()).toBe(walletBalance.toNumber());
  });

  test("6. Concurrent webhook deliveries for the same payment lock and do not double credit", async () => {
    process.env.PAYMENT_PROVIDER = "razorpay";
    const payload = {
      event_id: "evt_concurrent_1",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_concurrent_123",
            order_id: "order_rzp_test_1",
            amount: 50000,
          },
        },
      },
    };
    const rawBytes = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = signPayload(rawBytes);

    // Parallel calls
    const [res1, res2] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/payments/webhook",
        headers: { "content-type": "application/json", "x-razorpay-signature": signature },
        payload: rawBytes,
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/payments/webhook",
        headers: { "content-type": "application/json", "x-razorpay-signature": signature },
        payload: rawBytes,
      }),
    ]);

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    // Verify balance is credited exactly once
    const ledgerSum = ledgerEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));
    expect(walletBalance.toNumber()).toBe(1525);
    expect(ledgerSum.toNumber()).toBe(walletBalance.toNumber());
  });

  test("7. Simulated gateway is disabled when NODE_ENV=production", async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevProv = process.env.PAYMENT_PROVIDER;
    try {
      process.env.NODE_ENV = "production";
      process.env.PAYMENT_PROVIDER = "simulated";

      await expect(
        paymentsService.createPaymentOrder({ userId: "user-test-1", amount: 100 })
      ).rejects.toThrow("Simulated payment processing is disabled in production.");
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.PAYMENT_PROVIDER = prevProv;
    }
  });

  test("8. Razorpay createOrder fails with 501 when credentials not configured", async () => {
    const unconfigured = new RazorpayPaymentProvider();
    unconfigured.setCredentials("", "");
    await expect(
      unconfigured.createOrder({
        userId: "user-1",
        amountPaise: 10000,
        currency: "INR",
        receipt: "rcpt_test_1",
      })
    ).rejects.toThrow("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured");
  });
});
