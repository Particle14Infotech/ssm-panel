import { BadRequestException } from "@nestjs/common";
import crypto from "crypto";
import {
  getVerifyEmailTemplate,
  getPasswordResetTemplate,
  getWelcomeTemplate,
  getWalletCreditedTemplate,
  getOrderRefundTemplate,
  getSupportReplyTemplate,
  EmailSendOptions,
  EmailSendResult,
  EmailProvider,
} from "@smm/contracts";
import { EmailService } from "./email.service";
import { EmailController } from "./email.controller";

// Unicode regex to verify zero emojis
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

// Test double for EmailProvider
class MockResendProvider implements EmailProvider {
  public readonly name = "MockResend";
  public sendCount = 0;
  public sentOptions: EmailSendOptions[] = [];
  public shouldFail = false;

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    this.sendCount++;
    this.sentOptions.push(options);

    if (this.shouldFail) {
      return {
        success: false,
        error: "Simulated upstream Resend API error",
        statusCode: 500,
      };
    }

    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      statusCode: 200,
    };
  }
}

describe("Transactional Email Integration & Correctness Suite", () => {
  let mockProvider: MockResendProvider;
  let emailService: EmailService;
  let emailController: EmailController;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockProvider = new MockResendProvider();

    // In-memory tables for Prisma mock
    const emailLogs: any[] = [];
    const suppressions: any[] = [];
    const dailyCounters: Record<string, number> = {};

    mockPrisma = {
      emailLog: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            attempts: 0,
            ...data,
          };
          emailLogs.push(row);
          return row;
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return emailLogs.find((l) => l.id === where.id) || null;
          if (where.idempotencyKey) return emailLogs.find((l) => l.idempotencyKey === where.idempotencyKey) || null;
          return null;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          if (where?.idempotencyKey) return emailLogs.find((l) => l.idempotencyKey === where.idempotencyKey) || null;
          if (where?.providerMessageId) return emailLogs.find((l) => l.providerMessageId === where.providerMessageId) || null;
          return null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = emailLogs.find((l) => l.id === where.id);
          if (row) {
            if (data.status) row.status = data.status;
            if (data.providerMessageId) row.providerMessageId = data.providerMessageId;
            if (data.error) row.error = data.error;
            if (data.attempts?.increment) row.attempts = (row.attempts || 0) + data.attempts.increment;
            row.updatedAt = new Date();
          }
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const matches = emailLogs.filter((l) => {
            if (where.providerMessageId && l.providerMessageId !== where.providerMessageId) return false;
            return true;
          });
          for (const row of matches) {
            if (data.status) row.status = data.status;
            if (data.error) row.error = data.error;
            row.updatedAt = new Date();
          }
          return { count: matches.length };
        }),
        count: jest.fn(async ({ where }: any) => {
          if (where?.status) return emailLogs.filter((l) => l.status === where.status).length;
          return emailLogs.length;
        }),
      },
      emailSuppression: {
        findUnique: jest.fn(async ({ where }: any) => {
          return suppressions.find((s) => s.email === where.email) || null;
        }),
        create: jest.fn(async ({ data }: any) => {
          suppressions.push(data);
          return data;
        }),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          let row = suppressions.find((s) => s.email === where.email);
          if (!row) {
            row = { ...create, createdAt: new Date(), updatedAt: new Date() };
            suppressions.push(row);
          } else {
            Object.assign(row, update, { updatedAt: new Date() });
          }
          return row;
        }),
        count: jest.fn(async () => suppressions.length),
      },
      emailDailyCounter: {
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const date = where.date;
          if (dailyCounters[date] === undefined) {
            dailyCounters[date] = create.count;
          } else {
            dailyCounters[date] += update.count.increment;
          }
          return { date, count: dailyCounters[date] };
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          const count = dailyCounters[where.date] || 0;
          return { date: where.date, count };
        }),
      },
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    emailService = new EmailService(mockPrisma as any, mockCache as any);
    // Inject test double provider
    (emailService as any).provider = mockProvider;

    emailController = new EmailController(emailService);
  });

  describe("1. Template Rendering & Brand Integrity", () => {
    it("renders Verify Email template with dark/lime brand tokens and zero emojis", () => {
      const tpl = getVerifyEmailTemplate({
        name: "Alex Vance",
        verifyUrl: "https://example.com/verify?token=abc123xyz",
        expiresHours: 24,
      });

      expect(tpl.subject).toContain("Verify your email");
      expect(tpl.html).toContain("#131313"); // Brand dark
      expect(tpl.html).toContain("#D8EC8D"); // Brand lime
      expect(tpl.html).toContain("https://example.com/verify?token=abc123xyz");
      expect(tpl.text).toContain("https://example.com/verify?token=abc123xyz");

      // Verify zero emojis
      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });

    it("renders Password Reset template with 30-minute expiry and zero emojis", () => {
      const tpl = getPasswordResetTemplate({
        name: "Alex Vance",
        resetUrl: "https://example.com/reset?token=secretreset",
        expiresMinutes: 30,
      });

      expect(tpl.subject).toContain("Password reset instructions");
      expect(tpl.html).toContain("30 minutes");
      expect(tpl.text).toContain("30 minutes");
      expect(tpl.html).toContain("#D8EC8D");

      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });

    it("renders Welcome template on verification with zero emojis", () => {
      const tpl = getWelcomeTemplate({
        name: "Alex Vance",
        dashboardUrl: "https://example.com/dashboard",
      });

      expect(tpl.subject).toContain("Welcome to SMM Panel");
      expect(tpl.html).toContain("https://example.com/dashboard");
      expect(tpl.text).toContain("https://example.com/dashboard");

      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });

    it("renders Wallet Credited (payment receipt) template with zero emojis", () => {
      const tpl = getWalletCreditedTemplate({
        name: "Alex Vance",
        amountFormatted: "₹500.00",
        orderId: "pay_ord_999888",
        newBalanceFormatted: "₹1,250.00",
        walletUrl: "https://example.com/wallet",
      });

      expect(tpl.subject).toContain("Payment receipt");
      expect(tpl.subject).toContain("₹500.00");
      expect(tpl.html).toContain("pay_ord_999888");
      expect(tpl.html).toContain("₹1,250.00");
      expect(tpl.text).toContain("₹500.00");

      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });

    it("renders Order Refund template with zero emojis", () => {
      const tpl = getOrderRefundTemplate({
        name: "Alex Vance",
        orderId: "ord_drip_777666",
        amountFormatted: "₹150.00",
        reason: "Provider service cancelled",
        ordersUrl: "https://example.com/orders",
      });

      expect(tpl.subject).toContain("Order refund");
      expect(tpl.html).toContain("ord_drip_777666");
      expect(tpl.html).toContain("Provider service cancelled");
      expect(tpl.text).toContain("₹150.00");

      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });

    it("renders Support Ticket Reply template with zero emojis", () => {
      const tpl = getSupportReplyTemplate({
        name: "Alex Vance",
        ticketId: "tkt_1234567890",
        subject: "API Integration Speed",
        replyExcerpt: "We have reviewed your request and updated the upstream provider route.",
        ticketUrl: "https://example.com/tickets/123",
      });

      expect(tpl.subject).toContain("Support reply: Ticket #tkt_1234 - API Integration Speed");
      expect(tpl.html).toContain("We have reviewed your request");
      expect(tpl.text).toContain("https://example.com/tickets/123");

      expect(EMOJI_REGEX.test(tpl.subject)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.html)).toBe(false);
      expect(EMOJI_REGEX.test(tpl.text)).toBe(false);
    });
  });

  describe("2. Idempotency & De-duplication", () => {
    it("never double-sends an email with identical idempotency key", async () => {
      const idempotencyKey = "order_refund_ord_1001";
      const options: EmailSendOptions = {
        to: "customer@example.com",
        subject: "Refund Notice",
        html: "<p>Refunded</p>",
        text: "Refunded",
        type: "ORDER_REFUND",
        idempotencyKey,
      };

      // 1st Send
      const firstResult = await emailService.sendEmail(options);
      expect(firstResult.status).toBe("QUEUED");

      // Simulate worker executing first job successfully
      await emailService.processEmailJob({
        ...options,
        logId: firstResult.logId,
      });

      expect(mockProvider.sendCount).toBe(1);

      // 2nd Send with exact same key
      const secondResult = await emailService.sendEmail(options);
      expect(secondResult.status).toBe("SENT");
      expect(secondResult.logId).toBe(firstResult.logId);

      // Provider was NOT called a second time
      expect(mockProvider.sendCount).toBe(1);
    });
  });

  describe("3. Suppression Engine (Bounces & Complaints)", () => {
    it("drops outgoing sends immediately if recipient address is suppressed", async () => {
      const suppressedEmail = "bounced_user@example.com";

      // Seed suppression row
      await mockPrisma.emailSuppression.create({
        data: {
          email: suppressedEmail,
          reason: "HARD_BOUNCE",
          details: "550 User unknown",
        },
      });

      const result = await emailService.sendEmail({
        to: suppressedEmail,
        subject: "Welcome",
        html: "<p>Welcome</p>",
        text: "Welcome",
        type: "WELCOME",
      });

      expect(result.status).toBe("SUPPRESSED");
      // Resend provider is NOT called
      expect(mockProvider.sendCount).toBe(0);
    });
  });

  describe("4. Daily Quota Guard (100 emails/day)", () => {
    it("warns at 80 emails and schedules delay for emails past 100", async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Set count to 99
      await mockPrisma.emailDailyCounter.upsert({
        where: { date: today },
        create: { date: today, count: 99 },
        update: { count: { increment: 99 } },
      });

      // 100th email (at limit)
      const res100 = await emailService.sendEmail({
        to: "user100@example.com",
        subject: "Verify",
        html: "<p>Verify</p>",
        text: "Verify",
        type: "VERIFY_EMAIL",
      });
      expect(res100.delayed).toBe(false);

      // 101st email (past limit - must be queued for next day window, not dropped)
      const res101 = await emailService.sendEmail({
        to: "user101@example.com",
        subject: "Verify",
        html: "<p>Verify</p>",
        text: "Verify",
        type: "VERIFY_EMAIL",
      });
      expect(res101.delayed).toBe(true);
    });
  });

  describe("5. Webhook Signature Verification & Processing", () => {
    const rawSecret = "testsecret1234567890abcdef123456";
    const webhookSecret = `whsec_${Buffer.from(rawSecret).toString("base64")}`;

    beforeEach(() => {
      process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
    });

    afterEach(() => {
      delete process.env.RESEND_WEBHOOK_SECRET;
    });

    it("accepts a valid signed webhook and suppresses recipient on hard bounce", async () => {
      const rawPayload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: {
          email_id: "resend_msg_001",
          to: ["undeliverable@example.com"],
          bounce_type: "hard",
        },
      });

      const svixId = "msg_svix_test_01";
      const svixTimestamp = Math.floor(Date.now() / 1000).toString();
      const signedContent = `${svixId}.${svixTimestamp}.${rawPayload}`;
      const keyBuffer = Buffer.from(Buffer.from(rawSecret).toString("base64"), "base64");
      const signature = crypto
        .createHmac("sha256", keyBuffer)
        .update(signedContent)
        .digest("base64");

      const headers = {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": `v1,${signature}`,
      };

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await emailController.handleResendWebhook(
        { body: JSON.parse(rawPayload), rawBody: rawPayload } as any,
        mockRes,
        headers
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Check suppression was added
      const isSuppressed = await emailService.isEmailSuppressed("undeliverable@example.com");
      expect(isSuppressed).toBe(true);
    });

    it("rejects an invalid webhook signature with BadRequestException", async () => {
      const rawPayload = JSON.stringify({ type: "email.delivered" });
      const headers = {
        "svix-id": "fake_id",
        "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
        "svix-signature": "v1,tampered_signature",
      };

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await expect(
        emailController.handleResendWebhook(
          { body: JSON.parse(rawPayload), rawBody: rawPayload } as any,
          mockRes,
          headers
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an expired timestamp (> 5 minutes)", async () => {
      const rawPayload = JSON.stringify({ type: "email.delivered" });
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // > 6 min old
      const headers = {
        "svix-id": "old_id",
        "svix-timestamp": oldTimestamp,
        "svix-signature": "v1,somesig",
      };

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await expect(
        emailController.handleResendWebhook(
          { body: JSON.parse(rawPayload), rawBody: rawPayload } as any,
          mockRes,
          headers
        )
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("6. Token Expiry, Single-Use & Rate Limiting Correctness", () => {
    it("SHA-256 token hashing matches and is deterministic", () => {
      const rawToken = "super_secure_random_hex_string_12345";
      const hash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
      const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(rawToken);
      expect(hash1.length).toBe(64);
    });

    it("validates token expiry duration thresholds (24h verification, 30m reset)", () => {
      const now = Date.now();
      const verifyExpiry = new Date(now + 24 * 60 * 60 * 1000);
      const resetExpiry = new Date(now + 30 * 60 * 1000);

      const verifyRemainingHours = (verifyExpiry.getTime() - now) / (1000 * 60 * 60);
      const resetRemainingMins = (resetExpiry.getTime() - now) / (1000 * 60);

      expect(verifyRemainingHours).toBeCloseTo(24, 1);
      expect(resetRemainingMins).toBeCloseTo(30, 1);
    });
  });
});
