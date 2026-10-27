import { PaymentsService } from "../src/services/payments.service";
import { WalletService } from "../src/services/wallet.service";
import { Decimal } from "decimal.js";
import { PaymentStatus } from "@prisma/client";

describe("FIX 2: Durable Webhook Idempotency", () => {
  let paymentsService: PaymentsService;
  let mockPrisma: any;
  let mockWalletService: any;
  const processedEventsDb = new Map<string, any>();
  const paymentsDb = new Map<string, any>();
  const walletsDb = new Map<string, any>();
  const ledgerEntriesDb: any[] = [];

  function createTestService() {
    mockPrisma = {
      isConnected: true,
      processedWebhookEvent: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const compositeKey = `${data.provider}:${data.eventId}`;
          if (processedEventsDb.has(compositeKey)) {
            const err: any = new Error("Unique constraint failed on the fields: (`provider`,`eventId`)");
            err.code = "P2002";
            throw err;
          }
          const record = { id: `pwe_${Date.now()}`, ...data, createdAt: new Date() };
          processedEventsDb.set(compositeKey, record);
          return record;
        }),
      },
      payment: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return paymentsDb.get(where.gatewayOrderId) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const p = paymentsDb.get(where.id) || Array.from(paymentsDb.values()).find(x => x.id === where.id);
          if (p) {
            Object.assign(p, data);
            return p;
          }
          return null;
        }),
      },
      wallet: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return walletsDb.get(where.userId) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const w = Array.from(walletsDb.values()).find(x => x.id === where.id);
          if (w) {
            w.balance = data.balance;
            return w;
          }
          return null;
        }),
      },
      ledgerEntry: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const entry = { id: `led_${ledgerEntriesDb.length + 1}`, ...data };
          ledgerEntriesDb.push(entry);
          return entry;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockWalletService = new WalletService(mockPrisma);
    return new PaymentsService(mockPrisma, mockWalletService);
  }

  beforeEach(() => {
    processedEventsDb.clear();
    paymentsDb.clear();
    walletsDb.clear();
    ledgerEntriesDb.length = 0;

    walletsDb.set("user-123", {
      id: "wallet-123",
      userId: "user-123",
      balance: new Decimal(0),
    });

    paymentsDb.set("order_rzp_123", {
      id: "pay-rec-123",
      userId: "user-123",
      gatewayOrderId: "order_rzp_123",
      amount: new Decimal(100),
      bonusAmount: new Decimal(5),
      status: PaymentStatus.PENDING,
    });

    paymentsService = createTestService();
  });

  it("should atomically insert event row and credit wallet in one transaction", async () => {
    const payload = {
      event_id: "evt_razorpay_9999",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_test_1",
            order_id: "order_rzp_123",
            amount: 10000,
            method: "UPI",
          },
        },
      },
    };

    const res = await paymentsService.handleWebhook("dummy_signature", payload);
    expect(res.success).toBe(true);
    expect(res.processed).toBe(true);

    // Verify DB table recorded the event
    expect(processedEventsDb.has("simulated:evt_razorpay_9999")).toBe(true);

    // Verify wallet was credited 105 (100 + 5 bonus)
    const wallet = walletsDb.get("user-123");
    expect(Number(wallet.balance)).toBe(105);
    expect(ledgerEntriesDb.length).toBe(1);
    expect(Number(ledgerEntriesDb[0].amount)).toBe(105);
  });

  it("should reject concurrent duplicate webhooks on unique constraint without double crediting", async () => {
    const payload = {
      event_id: "evt_concurrent_123",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_test_2",
            order_id: "order_rzp_123",
            amount: 10000,
            method: "UPI",
          },
        },
      },
    };

    // Fire 2 concurrent webhooks
    const [res1, res2] = await Promise.all([
      paymentsService.handleWebhook("dummy_sig", payload),
      paymentsService.handleWebhook("dummy_sig", payload),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // Exactly one should be processed and one marked duplicate
    const results = [res1, res2];
    const processed = results.filter((r) => r.processed === true);
    const duplicate = results.filter((r) => r.duplicate === true);

    expect(processed.length).toBe(1);
    expect(duplicate.length).toBe(1);

    // Wallet balance must be credited exactly once
    const wallet = walletsDb.get("user-123");
    expect(Number(wallet.balance)).toBe(105);
    expect(ledgerEntriesDb.length).toBe(1);
  });

  it("should survive server restarts by reading from DB table and rejecting duplicates", async () => {
    const payload = {
      event_id: "evt_restart_test",
      payload: {
        payment: {
          entity: {
            id: "pay_rzp_test_3",
            order_id: "order_rzp_123",
            amount: 10000,
            method: "UPI",
          },
        },
      },
    };

    // 1. Process first webhook
    const res1 = await paymentsService.handleWebhook("dummy_sig", payload);
    expect(res1.processed).toBe(true);

    // 2. Simulate server restart: create brand new PaymentsService instance
    const restartedService = createTestService();

    // 3. Send the same webhook again to the restarted server
    const res2 = await restartedService.handleWebhook("dummy_sig", payload);
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
    expect(res2.processed).toBe(false);

    // 4. Wallet must still only be credited once
    const wallet = walletsDb.get("user-123");
    expect(Number(wallet.balance)).toBe(105);
    expect(ledgerEntriesDb.length).toBe(1);
  });
});
