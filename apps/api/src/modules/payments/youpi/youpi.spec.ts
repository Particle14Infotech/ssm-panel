import { YoupiService } from "./youpi.service";
import { YoupiGatewayProvider } from "./youpi-gateway.provider";
import { YoupiController } from "./youpi.controller";
import { YoupiPilotSettings, YoupiWebhookPayload, maskUtr, normalizeUtr } from "./youpi.types";
import { Decimal } from "@prisma/client/runtime/library";
import { YoupiTopUpStatus, TransactionType } from "@prisma/client";
import * as crypto from "node:crypto";
import { UnauthorizedException, ForbiddenException, BadRequestException } from "@nestjs/common";

describe("YouPI-PG Gateway & Webhook Security Suite", () => {
  let youpiService: YoupiService;
  let provider: YoupiGatewayProvider;
  let controller: YoupiController;
  let mockPrisma: any;
  let mockWalletService: any;

  const TEST_SECRET = "test_webhook_secret_32_bytes_long_entropy_key_!";
  const TEST_USER_A = "user_alpha_123";
  const TEST_USER_B = "user_bravo_456";
  const TEST_ADMIN_1 = "admin_super_1";
  const TEST_ADMIN_2 = "admin_auditor_2";

  // In-memory mock database state for test execution
  let inMemoryTopUps: Map<string, any>;
  let inMemoryDeliveries: Map<string, any>;
  let inMemoryObservations: any[];
  let inMemoryReviews: any[];
  let inMemoryWallets: Map<string, any>;
  let inMemoryLedger: any[];
  let inMemorySettings: any;

  beforeEach(() => {
    process.env.YOUPI_WEBHOOK_SECRET = TEST_SECRET;
    process.env.YOUPI_BASE_URL = "http://127.0.0.1:6100";
    process.env.YOUPI_MERCHANT_PUBLIC_KEY = "test_merchant_key";
    process.env.YOUPI_API_KEY = "test_api_key";

    inMemoryTopUps = new Map();
    inMemoryDeliveries = new Map();
    inMemoryObservations = [];
    inMemoryReviews = [];
    inMemoryWallets = new Map();
    inMemoryLedger = [];
    inMemorySettings = {
      key: "youpi_pilot_settings",
      value: {
        enabled: true,
        killSwitch: false,
        allowlistUserIds: [TEST_USER_A],
        receivingUpiIds: ["merchant@upi"],
        minAmountPaise: 10000, // ₹100
        maxAmountPaise: 200000, // ₹2,000
        maxDailyAttemptsPerAccount: 20,
        maxDailyCreditPaisePerAccount: 4000000,
        maxUserDailyAttempts: 3,
        maxUserDailyAmountPaise: 500000,
        secondApprovalThresholdPaise: 200000,
        sessionExpirySeconds: 300,
        webhookReplayWindowSeconds: 3600,
        pilotAcknowledgement: {
          adminName: "Lead Admin",
          confirmedAt: new Date().toISOString(),
          statement: "Confirmed compliance and pilot bank accounts."
        }
      }
    };

    // Initialize mock wallets
    inMemoryWallets.set(TEST_USER_A, { id: "wallet_a", userId: TEST_USER_A, balance: new Decimal("0.00") });
    inMemoryWallets.set(TEST_USER_B, { id: "wallet_b", userId: TEST_USER_B, balance: new Decimal("0.00") });

    mockPrisma = {
      systemSetting: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key === "youpi_pilot_settings") return Promise.resolve(inMemorySettings);
          return Promise.resolve(null);
        }),
        upsert: jest.fn().mockImplementation(({ create, update }) => {
          inMemorySettings = { key: "youpi_pilot_settings", value: update.value || create.value };
          return Promise.resolve(inMemorySettings);
        })
      },
      youpiTopUp: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = {
            id: `topup_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          inMemoryTopUps.set(item.id, item);
          inMemoryTopUps.set(item.orderRef, item);
          return Promise.resolve(item);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id) return Promise.resolve(inMemoryTopUps.get(where.id) || null);
          if (where.orderRef) return Promise.resolve(inMemoryTopUps.get(where.orderRef) || null);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          for (const item of inMemoryTopUps.values()) {
            let match = true;
            if (where.normalizedUtr && item.normalizedUtr !== where.normalizedUtr) match = false;
            if (where.status && item.status !== where.status) match = false;
            if (where.id?.not && item.id === where.id.not) match = false;
            if (match) return Promise.resolve(item);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(inMemoryTopUps.values()))),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = inMemoryTopUps.get(where.id || where.orderRef);
          if (item) {
            Object.assign(item, data, { updatedAt: new Date() });
            inMemoryTopUps.set(item.id, item);
            inMemoryTopUps.set(item.orderRef, item);
            return Promise.resolve(item);
          }
          return Promise.resolve(null);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          let count = 0;
          for (const item of inMemoryTopUps.values()) {
            if (where?.userId && item.userId !== where.userId) continue;
            if (where?.status && item.status !== where.status) continue;
            count++;
          }
          return Promise.resolve(count);
        }),
        aggregate: jest.fn().mockImplementation(() => Promise.resolve({ _sum: { amountPaise: 0 } })),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let updated = 0;
          for (const item of inMemoryTopUps.values()) {
            if (where?.status?.in && where.status.in.includes(item.status)) {
              Object.assign(item, data);
              updated++;
            }
          }
          return Promise.resolve({ count: updated });
        })
      },
      youpiWebhookDelivery: {
        create: jest.fn().mockImplementation(({ data }) => {
          if (inMemoryDeliveries.has(data.deliveryId)) {
            const err: any = new Error("Unique constraint failed on the fields: (`deliveryId`)");
            err.code = "P2002";
            return Promise.reject(err);
          }
          const item = { id: `del_${Date.now()}`, ...data, receivedAt: new Date() };
          inMemoryDeliveries.set(data.deliveryId, item);
          return Promise.resolve(item);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(inMemoryDeliveries.get(where.deliveryId) || null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = inMemoryDeliveries.get(where.deliveryId);
          if (item) Object.assign(item, data);
          return Promise.resolve(item);
        })
      },
      youpiObservation: {
        create: jest.fn().mockImplementation(({ data }) => {
          const obs = { id: `obs_${Date.now()}`, ...data, observedAt: new Date() };
          inMemoryObservations.push(obs);
          return Promise.resolve(obs);
        })
      },
      topUpReview: {
        create: jest.fn().mockImplementation(({ data }) => {
          const rev = { id: `rev_${Date.now()}`, ...data, createdAt: new Date() };
          inMemoryReviews.push(rev);
          return Promise.resolve(rev);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const found = inMemoryReviews.find(r => r.topUpId === where.topUpId && r.decision === where.decision);
          return Promise.resolve(found || null);
        })
      },
      wallet: {
        update: jest.fn().mockImplementation(({ where, data }) => {
          const w = inMemoryWallets.get(where.userId || (where.id === "wallet_a" ? TEST_USER_A : TEST_USER_B));
          if (w && data.balance?.increment) {
            w.balance = w.balance.plus(data.balance.increment);
          }
          return Promise.resolve(w);
        })
      },
      ledgerEntry: {
        create: jest.fn().mockImplementation(({ data }) => {
          const entry = { id: `ledg_${Date.now()}`, ...data, createdAt: new Date() };
          inMemoryLedger.push(entry);
          return Promise.resolve(entry);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(inMemoryLedger.find(l => l.referenceId === where.referenceId) || null);
        })
      },
      $queryRawUnsafe: jest.fn().mockImplementation((query: string, userId: string) => {
        const w = inMemoryWallets.get(userId);
        return Promise.resolve(w ? [{ id: w.id, balance: w.balance }] : []);
      }),
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return await callback(mockPrisma);
      })
    };

    mockWalletService = {
      creditFunds: jest.fn().mockImplementation((userId: string, amount: Decimal) => {
        const w = inMemoryWallets.get(userId);
        if (w) w.balance = w.balance.plus(amount);
        return Promise.resolve({ newBalance: w ? w.balance : amount });
      })
    };

    youpiService = new YoupiService(mockPrisma, mockWalletService);
    provider = new YoupiGatewayProvider(youpiService, mockPrisma);
    controller = new YoupiController(youpiService, mockPrisma);

    // Inject mock fetch returning simulated upstream session
    youpiService.setFetchClient(jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({
        paymentId: "upstream_sess_123",
        orderId: "youpi_mock",
        amount: "500.00",
        amountPaise: "50000",
        currency: "INR",
        status: "INITIATED",
        checkoutUrl: "http://127.0.0.1:7000/checkout/upstream_sess_123"
      })
    } as any));
  });

  function signPayload(body: string, secret = TEST_SECRET, timestamp?: number): Record<string, string> {
    const sigV1 = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const headers: Record<string, string> = {
      "X-Gateway-Signature": `sha256=${sigV1}`,
      "x-gateway-delivery-id": `del_${Math.random().toString(36).substring(2, 9)}`
    };
    if (timestamp !== undefined) {
      const sigV2 = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
      headers["X-Gateway-Signature-V2"] = `sha256=${sigV2}`;
      headers["X-Gateway-Timestamp"] = timestamp.toString();
    }
    return headers;
  }

  // 1. Signature Tests
  describe("Webhook Signature & Tamper Resistance", () => {
    it("rejects missing X-Gateway-Signature with 401", async () => {
      const body = Buffer.from(JSON.stringify({ event: "OBSERVED_SUCCESS", deliveryId: "d1" }));
      await expect(
        youpiService.handleWebhookDelivery(body, {}, JSON.parse(body.toString()))
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects bad/tampered signature with 401", async () => {
      const body = Buffer.from(JSON.stringify({ event: "OBSERVED_SUCCESS", deliveryId: "d2" }));
      const headers = { "x-gateway-signature": "sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb" };
      await expect(
        youpiService.handleWebhookDelivery(body, headers, JSON.parse(body.toString()))
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects wrong secret with 401", async () => {
      const body = Buffer.from(JSON.stringify({ event: "OBSERVED_SUCCESS", deliveryId: "d3" }));
      const headers = signPayload(body.toString(), "wrong_secret_entropy_key_64_bytes_!!");
      await expect(
        youpiService.handleWebhookDelivery(body, headers, JSON.parse(body.toString()))
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects V2 timestamp outside the 1-hour replay window", async () => {
      const body = Buffer.from(JSON.stringify({ event: "OBSERVED_SUCCESS", deliveryId: "d4" }));
      const expiredTimestamp = Date.now() - (3601 * 1000); // 1 hour + 1 second ago
      const headers = signPayload(body.toString(), TEST_SECRET, expiredTimestamp);
      await expect(
        youpiService.handleWebhookDelivery(body, headers, JSON.parse(body.toString()))
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // 2. DeliveryId Deduplication & Parallel Concurrency
  describe("DeliveryId Deduplication & Concurrency", () => {
    it("ignores replayed deliveryId and returns duplicate status without crediting", async () => {
      const payload: YoupiWebhookPayload = {
        event: "OBSERVED_SUCCESS",
        deliveryId: "del_unique_1",
        timestamp: Date.now(),
        paymentId: "p1",
        orderId: "ord1",
        amount: "500.00",
        amountPaise: 50000,
        currency: "INR"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const first = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(first.credited).toBe(false);

      const second = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(second.status).toBe("duplicate");
      expect(second.credited).toBe(false);
    });

    it("50 parallel identical deliveries credit at most once", async () => {
      // Create top-up first
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_parallel_50",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "RECONCILED",
        deliveryId: "del_par_50",
        timestamp: Date.now(),
        paymentId: topUp.id,
        orderId: topUp.orderRef,
        amount: "500.00",
        amountPaise: 50000,
        currency: "INR",
        method: "UPI",
        settlementState: "RECONCILED",
        utr: "123456789012"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      // Fire 50 concurrent deliveries with the same deliveryId
      const results = await Promise.all(
        Array.from({ length: 50 }).map(() =>
          youpiService.handleWebhookDelivery(raw, headers, payload)
        )
      );

      const creditedResults = results.filter(r => r.credited === true);
      expect(creditedResults.length).toBe(1);

      // Wallet should have incremented exactly once (500 + 5% bonus = 525 INR)
      const wallet = inMemoryWallets.get(TEST_USER_A);
      expect(wallet.balance.toString()).toBe("525");
    });
  });

  // 3. Event Handling: OBSERVED_SUCCESS vs RECONCILED
  describe("Rule 6 Invariants: OBSERVED_SUCCESS Never Credits, RECONCILED Credits Once", () => {
    it("CRITICAL: OBSERVED_SUCCESS NEVER credits wallet under any circumstances", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_obs_never_credit",
          amountPaise: 100000,
          currency: "INR",
          status: YoupiTopUpStatus.AWAITING_PAYMENT
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "OBSERVED_SUCCESS",
        deliveryId: "del_obs_999",
        timestamp: Date.now(),
        paymentId: topUp.id,
        orderId: topUp.orderRef,
        amount: "1000.00",
        amountPaise: 100000,
        currency: "INR",
        settlementState: "NOT_RECONCILED"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const res = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(res.credited).toBe(false);

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.OBSERVED);

      // User wallet balance MUST REMAIN ZERO
      const wallet = inMemoryWallets.get(TEST_USER_A);
      expect(wallet.balance.toString()).toBe("0");
    });

    it("RECONCILED credits wallet with standard bonus once", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_reconcile_once",
          amountPaise: 100000, // ₹1,000 (10% bonus = ₹100, total ₹1,100)
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "RECONCILED",
        deliveryId: "del_rec_100",
        timestamp: Date.now(),
        paymentId: topUp.id,
        orderId: topUp.orderRef,
        amount: "1000.00",
        amountPaise: 100000,
        currency: "INR",
        method: "UPI",
        settlementState: "RECONCILED",
        utr: "987654321098"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const res = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(res.credited).toBe(true);

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.CREDITED);
      expect(updated.normalizedUtr).toBe("987654321098");

      const wallet = inMemoryWallets.get(TEST_USER_A);
      expect(wallet.balance.toString()).toBe("1100");
    });

    it("flags SUSPICIOUS and does not credit if same UTR was already credited", async () => {
      // Existing credited top-up with UTR
      await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_B,
          orderRef: "order_prior_credited",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.CREDITED,
          normalizedUtr: "REUSED_UTR_1234"
        }
      });

      // New top-up attempting to reuse the same UTR
      const topUp2 = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_try_reuse",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "RECONCILED",
        deliveryId: "del_reuse_attempt",
        timestamp: Date.now(),
        paymentId: topUp2.id,
        orderId: topUp2.orderRef,
        amount: "500.00",
        amountPaise: 50000,
        currency: "INR",
        method: "UPI",
        settlementState: "RECONCILED",
        utr: "reused_utr_1234"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const res = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(res.credited).toBe(false);
      expect(res.status).toBe("DUPLICATE_UTR_SUSPICIOUS");

      const updated = inMemoryTopUps.get(topUp2.id);
      expect(updated.status).toBe(YoupiTopUpStatus.SUSPICIOUS);
    });

    it("flags SUSPICIOUS on amount mismatch in paise", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_amt_mismatch",
          amountPaise: 100000, // ₹1,000
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "RECONCILED",
        deliveryId: "del_mismatch",
        timestamp: Date.now(),
        paymentId: topUp.id,
        orderId: topUp.orderRef,
        amount: "500.00",
        amountPaise: 50000, // Mismatched ₹500
        currency: "INR",
        method: "UPI",
        settlementState: "RECONCILED",
        utr: "112233445566"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const res = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(res.credited).toBe(false);
      expect(res.status).toBe("AMOUNT_MISMATCH_SUSPICIOUS");

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.SUSPICIOUS);
    });

    it("flags SUSPICIOUS on currency mismatch", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_curr_mismatch",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      const payload: YoupiWebhookPayload = {
        event: "RECONCILED",
        deliveryId: "del_curr_mismatch",
        timestamp: Date.now(),
        paymentId: topUp.id,
        orderId: topUp.orderRef,
        amount: "500.00",
        amountPaise: 50000,
        currency: "USD",
        method: "UPI",
        settlementState: "RECONCILED",
        utr: "998877665544"
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const headers = signPayload(raw.toString(), TEST_SECRET, payload.timestamp);

      const res = await youpiService.handleWebhookDelivery(raw, headers, payload);
      expect(res.credited).toBe(false);

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.SUSPICIOUS);
    });
  });

  // 4. Admin Confirmation, RBAC, Dual Approval
  describe("Admin Confirmation Path & RBAC", () => {
    it("admin confirm credits top-up once and records reason in audit log", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_admin_confirm_1",
          amountPaise: 100000, // ₹1,000 (below dual threshold ₹2,000)
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED,
          normalizedUtr: "ADMIN_CONFIRM_UTR"
        }
      });

      const res = await youpiService.confirmTopUp(topUp.id, TEST_ADMIN_1, "Verified directly in HDFC Bank mobile app.");
      expect(res.success).toBe(true);
      expect(res.creditedAmountPaise).toBe(110000); // 1000 + 100 bonus

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.CREDITED);

      // Confirming again returns success idempotently without extra credit
      const res2 = await youpiService.confirmTopUp(topUp.id, TEST_ADMIN_1, "Verified directly in HDFC Bank mobile app.");
      expect(res2.success).toBe(true);

      const wallet = inMemoryWallets.get(TEST_USER_A);
      expect(wallet.balance.toString()).toBe("1100");
    });

    it("enforces dual-control second approval for top-ups at or above threshold (>= ₹2,000)", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_threshold_test",
          amountPaise: 200000, // ₹2,000 (meets threshold)
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      // Stage 1 approval by Admin 1 -> records PENDING_SECOND_APPROVAL
      const stage1 = await youpiService.confirmTopUp(topUp.id, TEST_ADMIN_1, "Stage 1 verification: bank alert checked.");
      expect(stage1.success).toBe(true);
      expect(stage1.creditedAmountPaise).toBe(0); // Not credited yet!

      // Admin 1 cannot perform second approval on their own request!
      await expect(
        youpiService.confirmTopUp(topUp.id, TEST_ADMIN_1, "Stage 2 attempt by same admin")
      ).rejects.toThrow(ForbiddenException);

      // Admin 2 performs second approval -> credits wallet
      const stage2 = await youpiService.confirmTopUp(topUp.id, TEST_ADMIN_2, "Stage 2 approval: confirmed in bank portal statement.");
      expect(stage2.success).toBe(true);
      expect(stage2.creditedAmountPaise).toBe(220000); // 2000 + 10% bonus

      const updated = inMemoryTopUps.get(topUp.id);
      expect(updated.status).toBe(YoupiTopUpStatus.CREDITED);
    });

    it("rejects confirmation if reason is under 10 characters", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_short_reason",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.OBSERVED
        }
      });

      await expect(
        youpiService.confirmTopUp(topUp.id, TEST_ADMIN_1, "too short")
      ).rejects.toThrow(BadRequestException);
    });

    it("user B cannot read user A's top-up status", async () => {
      const topUp = await mockPrisma.youpiTopUp.create({
        data: {
          userId: TEST_USER_A,
          orderRef: "order_user_a_private",
          amountPaise: 50000,
          currency: "INR",
          status: YoupiTopUpStatus.AWAITING_PAYMENT
        }
      });

      await expect(
        controller.getTopUpStatus({ id: TEST_USER_B, role: "CUSTOMER" } as any, topUp.orderRef)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // 5. Caps, Kill Switch & Pilot Allowlist
  describe("Caps, Kill Switch & Pilot Allowlist", () => {
    it("blocks top-up creation when user is not on allowlist", async () => {
      await expect(
        youpiService.createTopUp(TEST_USER_B, 500)
      ).rejects.toThrow(ForbiddenException);
    });

    it("blocks top-up creation immediately when kill switch is enabled", async () => {
      inMemorySettings.value.killSwitch = true;
      await expect(
        youpiService.createTopUp(TEST_USER_A, 500)
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects amounts below min or above max", async () => {
      await expect(youpiService.createTopUp(TEST_USER_A, 50)).rejects.toThrow(BadRequestException); // below ₹100
      await expect(youpiService.createTopUp(TEST_USER_A, 2500)).rejects.toThrow(BadRequestException); // above ₹2,000
    });
  });

  // 6. Masking & Privacy
  describe("Masking & Data Privacy", () => {
    it("masks UTR showing only last 4 characters", () => {
      expect(maskUtr("123456789012")).toBe("****9012");
      expect(maskUtr("ABCD")).toBe("****");
      expect(maskUtr(null)).toBe("N/A");
    });

    it("normalizes UTR to trimmed upper-case", () => {
      expect(normalizeUtr("  utr-1234abcd  ")).toBe("UTR-1234ABCD");
    });
  });
});
