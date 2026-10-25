import { SimulatedPaymentProvider } from "./simulated-payment.provider";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";
import { PaymentsService } from "./payments.service";
import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";

describe("Phase 5 Payments Architecture & Security Tests", () => {
  describe("SimulatedPaymentProvider", () => {
    let provider: SimulatedPaymentProvider;

    beforeEach(() => {
      provider = new SimulatedPaymentProvider();
    });

    it("creates simulated payment orders with integer paise", async () => {
      const order = await provider.createOrder({
        userId: "user_sim_1",
        amountPaise: 50000, // ₹500.00
        currency: "INR",
        receipt: "rcpt_test_1",
      });

      expect(order.orderId).toMatch(/^order_/);
      expect(order.amountPaise).toBe(50000);
      expect(order.currency).toBe("INR");
      expect(order.status).toBe("created");
    });

    it("approves payment verification for success@test simulator", async () => {
      const res = await provider.verifyPayment({
        orderId: "order_sim_123",
        paymentId: "pay_sim_123",
        userId: "user_sim_1",
        method: "UPI",
        testOutcome: "success",
      });

      expect(res.success).toBe(true);
      expect(res.paymentId).toBe("pay_sim_123");
      expect(res.status).toBe("paid");
    });

    it("rejects payment verification when test outcome is failure", async () => {
      const res = await provider.verifyPayment({
        orderId: "order_sim_123",
        paymentId: "pay_sim_123",
        userId: "user_sim_1",
        method: "UPI",
        testOutcome: "failure",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/declined/i);
    });

    it("handles webhook payloads gracefully", async () => {
      const webhookRes = await provider.handleWebhook(
        { event: "payment.captured", paymentId: "pay_1" },
        "test_sig"
      );
      expect(webhookRes.success).toBe(true);
    });
  });

  describe("RazorpayPaymentProvider Cryptography & Webhook", () => {
    const keyId = "rzp_test_sampleKey";
    const keySecret = "secret_sample_key_12345";
    let provider: RazorpayPaymentProvider;

    beforeEach(() => {
      provider = new RazorpayPaymentProvider();
      provider.setCredentials(keyId, keySecret);
    });

    it("verifies authentic HMAC-SHA256 signature", async () => {
      const orderId = "order_rzp_987654";
      const paymentId = "pay_rzp_123456";
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const res = await provider.verifyPayment({
        orderId,
        paymentId,
        signature: expectedSignature,
        userId: "user_rzp_1",
      });

      expect(res.success).toBe(true);
      expect(res.paymentId).toBe(paymentId);
    });

    it("rejects tampered HMAC-SHA256 signature", async () => {
      const orderId = "order_rzp_987654";
      const paymentId = "pay_rzp_123456";

      const res = await provider.verifyPayment({
        orderId,
        paymentId,
        signature: "tampered_signature_hex",
        userId: "user_rzp_1",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid.*signature/i);
    });

    it("verifies webhook payload HMAC signature", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const webhookSecret = "webhook_secret_abc";
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      const res = await provider.handleWebhook(payload, validSignature, webhookSecret);
      expect(res.success).toBe(true);
    });
  });

  describe("PaymentsService Business Logic & Security Invariants", () => {
    let service: PaymentsService;
    let mockPrisma: any;
    let mockWalletService: any;
    let originalEnvironment: Record<string, string | undefined>;
    const environmentKeys = [
      "NODE_ENV",
      "PAYMENT_PROVIDER",
      "ALLOW_SIMULATED_PAYMENTS",
      "PAYMENTS_MODE",
    ];

    beforeEach(() => {
      originalEnvironment = Object.fromEntries(
        environmentKeys.map((key) => [key, process.env[key]])
      );
      process.env.NODE_ENV = "test";
      process.env.PAYMENT_PROVIDER = "simulated";

      mockPrisma = {
        isConnected: false, // tests sandbox memory flow first
        payment: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        wallet: {
          update: jest.fn(),
        },
        ledgerEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        $queryRawUnsafe: jest.fn(),
        $transaction: jest.fn(),
      };

      mockWalletService = {
        creditFunds: jest.fn().mockResolvedValue({ success: true }),
      };

      service = new PaymentsService(mockPrisma as any, mockWalletService as any);
    });

    afterEach(() => {
      for (const key of environmentKeys) {
        const value = originalEnvironment[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it("converts amount to integer paise and computes standard promotional bonus", async () => {
      const order = await service.createPaymentOrder({
        userId: "usr_alice",
        amount: 1000, // ₹1,000 -> 100,000 paise
      });

      expect(order.amountRupees).toBe(1000);
      expect(order.amountPaise).toBe(100000);
      expect(order.currency).toBe("INR");
      expect(order.bonusAmount).toBe(100); // 10% on ₹1,000
    });

    it("rejects non-positive payment amount", async () => {
      await expect(
        service.createPaymentOrder({
          userId: "usr_alice",
          amount: 0,
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createPaymentOrder({
          userId: "usr_alice",
          amount: -50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("verifies payment server-side and credits wallet", async () => {
      const order = await service.createPaymentOrder({
        userId: "usr_alice",
        amount: 500,
      });

      const verifyRes = await service.verifyPayment({
        orderId: order.orderId,
        paymentId: "pay_test_succ_1",
        userId: "usr_alice",
        method: "UPI",
        testOutcome: "success",
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.status).toBe("paid");
      expect(mockWalletService.creditFunds).toHaveBeenCalled();
    });

    it("enforces idempotency: multiple verify calls do NOT double credit", async () => {
      const order = await service.createPaymentOrder({
        userId: "usr_alice",
        amount: 500,
      });

      // First verification
      await service.verifyPayment({
        orderId: order.orderId,
        paymentId: "pay_test_succ_2",
        userId: "usr_alice",
        method: "UPI",
        testOutcome: "success",
      });

      expect(mockWalletService.creditFunds).toHaveBeenCalledTimes(1);

      // Second verification (retry / replay / double-click)
      const secondVerify = await service.verifyPayment({
        orderId: order.orderId,
        paymentId: "pay_test_succ_2",
        userId: "usr_alice",
        method: "UPI",
        testOutcome: "success",
      });

      expect(secondVerify.success).toBe(true);
      expect(secondVerify.message).toMatch(/already verified and credited/i);
      // creditFunds should NOT have been called a second time
      expect(mockWalletService.creditFunds).toHaveBeenCalledTimes(1);
    });

    it("enforces user isolation: rejects verification if userId does not match payment order owner", async () => {
      const order = await service.createPaymentOrder({
        userId: "usr_alice",
        amount: 500,
      });

      // User Bob attempts to verify Alice's order
      await expect(
        service.verifyPayment({
          orderId: order.orderId,
          paymentId: "pay_test_tamper_1",
          userId: "usr_bob",
          method: "UPI",
          testOutcome: "success",
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("never verifies or credits a simulated payment in production, even with legacy sandbox flags", async () => {
      const order = await service.createPaymentOrder({
        userId: "usr_alice",
        amount: 500,
      });

      process.env.NODE_ENV = "production";
      process.env.PAYMENT_PROVIDER = "simulated";
      process.env.ALLOW_SIMULATED_PAYMENTS = "true";
      process.env.PAYMENTS_MODE = "sandbox";

      await expect(
        service.verifyPayment({
          orderId: order.orderId,
          paymentId: "pay_test_prod_1",
          userId: "usr_alice",
          testOutcome: "success",
        })
      ).rejects.toThrow(ForbiddenException);
      expect(mockWalletService.creditFunds).not.toHaveBeenCalled();

      await expect(
        service.handleWebhook("unverified-signature", {
          gatewayOrderId: order.orderId,
          paymentId: "pay_test_prod_1",
        })
      ).rejects.toThrow(ForbiddenException);
      expect(mockWalletService.creditFunds).not.toHaveBeenCalled();
    });
  });
});
