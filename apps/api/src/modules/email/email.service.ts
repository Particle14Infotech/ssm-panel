import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { EmailProvider, EmailSendOptions, EmailSendResult, EmailType } from "./email.interface";
import { ResendProvider } from "./providers/resend.provider";
import { LogOnlyEmailProvider } from "./providers/log-only.provider";
import {
  getVerifyEmailTemplate,
  getPasswordResetTemplate,
  getWelcomeTemplate,
  getWalletCreditedTemplate,
  getOrderRefundTemplate,
  getSupportReplyTemplate,
} from "./templates";
import { Queue } from "bullmq";
import Redis from "ioredis";
import crypto from "crypto";

const DAILY_LIMIT = 100;
const WARNING_THRESHOLD = 80;

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private provider: EmailProvider;
  private emailQueue: Queue | null = null;
  private redisConnection: Redis | null = null;

  constructor(
    private prisma: PrismaService,
    private cache: SMMCacheService
  ) {
    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "SMM Panel <no-reply@smmpanel.internal>";
    const emailReplyTo = process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL;

    if (resendKey && resendKey.trim() !== "" && !resendKey.startsWith("REPLACE_ME")) {
      this.provider = new ResendProvider(resendKey, emailFrom, emailReplyTo);
      this.logger.log(`[Email] Provider initialized: Resend HTTPS API (From: ${emailFrom})`);
    } else {
      this.provider = new LogOnlyEmailProvider();
      this.logger.warn(`[Email] RESEND_API_KEY not configured. Running in LOG-ONLY simulated mode.`);
    }
  }

  async onModuleInit() {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        this.redisConnection = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null,
        });
      } else {
        const host = process.env.REDIS_HOST || "localhost";
        const port = parseInt(process.env.REDIS_PORT || "6379", 10);
        this.redisConnection = new Redis({
          host,
          port,
          maxRetriesPerRequest: 1,
          connectTimeout: 1000,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null,
        });
      }

      this.redisConnection.on("error", () => {
        // Suppress unhandled ioredis AggregateError
      });

      await this.redisConnection.connect().catch(() => null);
      if (this.redisConnection.status === "ready") {
        this.emailQueue = new Queue("email", { connection: this.redisConnection as any });
        this.logger.log("[Email] BullMQ 'email' queue initialized successfully");
      } else {
        this.logger.warn("[Email] Redis not ready. Emails will be processed via direct transactional dispatch.");
      }
    } catch (err: any) {
      this.logger.warn(`[Email] Could not initialize BullMQ email queue: ${err.message}. Using fallback.`);
    }
  }

  async onModuleDestroy() {
    if (this.emailQueue) {
      await this.emailQueue.close().catch(() => null);
    }
    if (this.redisConnection) {
      await this.redisConnection.quit().catch(() => null);
    }
  }

  /**
   * Primary method to dispatch emails asynchronously
   */
  async sendEmail(options: EmailSendOptions): Promise<{ logId: string; status: string; delayed?: boolean }> {
    const cleanTo = options.to.toLowerCase().trim();

    // 1. Check suppression list (bounces / spam complaints)
    const isSuppressed = await this.isEmailSuppressed(cleanTo);
    if (isSuppressed) {
      this.logger.warn(`[Email Suppression] Recipient ${cleanTo} is suppressed. Dropping email.`);
      const log = await this.prisma.emailLog.create({
        data: {
          to: cleanTo,
          userId: options.userId,
          type: options.type,
          subject: options.subject,
          status: "FAILED",
          error: "Recipient is suppressed due to prior bounce or complaint",
          idempotencyKey: options.idempotencyKey,
        },
      });
      return { logId: log.id, status: "SUPPRESSED" };
    }

    // 2. Check idempotency (prevent double send of same event)
    if (options.idempotencyKey) {
      const existing = await this.prisma.emailLog.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existing && (existing.status === "SENT" || existing.status === "DELIVERED")) {
        this.logger.log(`[Email Idempotency] Email with key '${options.idempotencyKey}' already sent. Skipping.`);
        return { logId: existing.id, status: existing.status };
      }
    }

    // 3. Daily quota check (Free tier 100 emails/day)
    const today = new Date().toISOString().slice(0, 10);
    const counter = await this.prisma.emailDailyCounter.upsert({
      where: { date: today },
      update: { count: { increment: 1 } },
      create: { date: today, count: 1 },
    });

    let delayMs = 0;
    if (counter.count === WARNING_THRESHOLD) {
      this.logger.warn(`[Email Quota Alert] 80% of daily quota reached (${counter.count}/${DAILY_LIMIT}).`);
    } else if (counter.count > DAILY_LIMIT) {
      // Calculate delay until tomorrow 00:05 UTC
      const now = new Date();
      const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
      delayMs = Math.max(1000, tomorrowUtc.getTime() - now.getTime());
      this.logger.warn(
        `[Email Quota Exceeded] Daily quota (${DAILY_LIMIT}) reached. Queueing ${options.type} email for next daily window (delay: ${Math.round(delayMs / 60000)}m).`
      );
    }

    // 4. Create PENDING log row
    const emailLog = await this.prisma.emailLog.create({
      data: {
        to: cleanTo,
        userId: options.userId,
        type: options.type,
        subject: options.subject,
        status: "PENDING",
        idempotencyKey: options.idempotencyKey,
      },
    });

    const jobPayload = {
      ...options,
      to: cleanTo,
      logId: emailLog.id,
    };

    // 5. Enqueue in BullMQ or execute
    if (this.emailQueue) {
      await this.emailQueue.add("send-email", jobPayload, {
        delay: delayMs,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });
    } else {
      // Direct execution if queue is unavailable
      if (delayMs > 0) {
        const timer = setTimeout(() => this.processEmailJob(jobPayload), Math.min(delayMs, 60000));
        timer.unref?.();
      } else {
        setImmediate(() => this.processEmailJob(jobPayload));
      }
    }

    return { logId: emailLog.id, status: "QUEUED", delayed: delayMs > 0 };
  }

  /**
   * Processes the email job (called by Worker or async fallback)
   */
  async processEmailJob(jobData: EmailSendOptions & { logId: string }): Promise<EmailSendResult> {
    const result = await this.provider.send(jobData);

    if (result.success && result.messageId) {
      await this.prisma.emailLog.update({
        where: { id: jobData.logId },
        data: {
          status: "SENT",
          providerMessageId: result.messageId,
          attempts: { increment: 1 },
        },
      });
      this.logger.log(`[Email Sent] ${jobData.type} sent to ${jobData.to} (MessageId: ${result.messageId})`);
    } else {
      await this.prisma.emailLog.update({
        where: { id: jobData.logId },
        data: {
          status: "FAILED",
          error: result.error || "Unknown dispatch failure",
          attempts: { increment: 1 },
        },
      });
      this.logger.error(`[Email Failed] Failed to send ${jobData.type} to ${jobData.to}: ${result.error}`);
    }

    return result;
  }

  /**
   * Check if recipient address has previously bounced or filed a complaint
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    const suppression = await this.prisma.emailSuppression.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return !!suppression;
  }

  /**
   * Verifies Svix webhook signatures from Resend
   */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | string[] | undefined>, secret?: string): boolean {
    const webhookSecret = secret || process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn("[Email Webhook] RESEND_WEBHOOK_SECRET not configured. Rejecting webhook.");
      return false;
    }

    const svixId = Array.isArray(headers["svix-id"]) ? headers["svix-id"][0] : headers["svix-id"];
    const svixTimestamp = Array.isArray(headers["svix-timestamp"]) ? headers["svix-timestamp"][0] : headers["svix-timestamp"];
    const svixSignature = Array.isArray(headers["svix-signature"]) ? headers["svix-signature"][0] : headers["svix-signature"];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return false;
    }

    // Reject timestamps older than 5 minutes to prevent replay attacks
    const timestampSec = parseInt(svixTimestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(timestampSec) || Math.abs(nowSec - timestampSec) > 300) {
      return false;
    }

    try {
      // Secret key normalization (strip 'whsec_' prefix if present and decode base64)
      const cleanKey = webhookSecret.startsWith("whsec_") ? webhookSecret.substring(6) : webhookSecret;
      const keyBuffer = Buffer.from(cleanKey, "base64");

      const signaturePayload = `${svixId}.${svixTimestamp}.${rawBody}`;
      const expectedSignature = crypto.createHmac("sha256", keyBuffer).update(signaturePayload).digest("base64");

      // Signatures header may contain multiple space-delimited signatures, e.g. "v1,signature"
      const passedSignatures = svixSignature.split(" ").map((s) => (s.startsWith("v1,") ? s.substring(3) : s));

      return passedSignatures.some((sig) => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature));
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Handles verified Resend webhook events (delivered, bounced, complained)
   */
  async handleWebhookEvent(event: any): Promise<{ handled: boolean; action?: string }> {
    const eventType = event.type;
    const data = event.data;
    const emailId = data?.email_id;
    const recipient = Array.isArray(data?.to) ? data.to[0] : data?.to;

    this.logger.log(`[Email Webhook] Processing event: ${eventType} for message ${emailId}`);

    if (eventType === "email.delivered" && emailId) {
      await this.prisma.emailLog.updateMany({
        where: { providerMessageId: emailId },
        data: { status: "DELIVERED" },
      });
      return { handled: true, action: "MARKED_DELIVERED" };
    }

    if (eventType === "email.bounced" && recipient) {
      if (emailId) {
        await this.prisma.emailLog.updateMany({
          where: { providerMessageId: emailId },
          data: { status: "BOUNCED", error: data?.bounce?.message || "Hard bounce received" },
        });
      }
      await this.prisma.emailSuppression.upsert({
        where: { email: recipient.toLowerCase().trim() },
        update: { reason: "BOUNCE" },
        create: { email: recipient.toLowerCase().trim(), reason: "BOUNCE" },
      });
      return { handled: true, action: "SUPPRESSED_BOUNCE" };
    }

    if (eventType === "email.complained" && recipient) {
      if (emailId) {
        await this.prisma.emailLog.updateMany({
          where: { providerMessageId: emailId },
          data: { status: "COMPLAINED", error: "Spam complaint received" },
        });
      }
      await this.prisma.emailSuppression.upsert({
        where: { email: recipient.toLowerCase().trim() },
        update: { reason: "COMPLAINT" },
        create: { email: recipient.toLowerCase().trim(), reason: "COMPLAINT" },
      });
      return { handled: true, action: "SUPPRESSED_COMPLAINT" };
    }

    return { handled: true, action: "NOOP" };
  }

  // --- High-Level Notification Dispatchers ---

  async sendVerificationEmail(user: { id: string; email: string; name: string }, rawToken: string) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const verifyUrl = `${webUrl}/verify?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    const template = getVerifyEmailTemplate({
      name: user.name,
      verifyUrl,
      expiresHours: 24,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "VERIFY_EMAIL",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `verify_${user.id}_${crypto.createHash("sha256").update(rawToken).digest("hex").slice(0, 16)}`,
    });
  }

  async sendPasswordResetEmail(user: { id: string; email: string; name: string }, rawToken: string) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const resetUrl = `${webUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    const template = getPasswordResetTemplate({
      name: user.name,
      resetUrl,
      expiresMinutes: 30,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "PASSWORD_RESET",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `reset_${user.id}_${crypto.createHash("sha256").update(rawToken).digest("hex").slice(0, 16)}`,
    });
  }

  async sendWelcomeEmail(user: { id: string; email: string; name: string }) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const template = getWelcomeTemplate({
      name: user.name,
      dashboardUrl: `${webUrl}/app/dashboard`,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "WELCOME",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `welcome_${user.id}`,
    });
  }

  async sendWalletCreditedEmail(
    user: { id: string; email: string; name: string },
    amountFormatted: string,
    orderId: string,
    newBalanceFormatted: string
  ) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const template = getWalletCreditedTemplate({
      name: user.name,
      amountFormatted,
      orderId,
      newBalanceFormatted,
      walletUrl: `${webUrl}/app/wallet`,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "PAYMENT_RECEIPT",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `deposit_${orderId}`,
    });
  }

  async sendOrderRefundEmail(
    user: { id: string; email: string; name: string },
    orderId: string,
    amountFormatted: string,
    reason: string
  ) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const template = getOrderRefundTemplate({
      name: user.name,
      orderId,
      amountFormatted,
      reason,
      ordersUrl: `${webUrl}/app/orders`,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "ORDER_REFUND",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `refund_${orderId}`,
    });
  }

  async sendSupportReplyEmail(
    user: { id: string; email: string; name: string },
    ticketId: string,
    subject: string,
    replyText: string
  ) {
    const webUrl = process.env.FRONTEND_URL || process.env.WEB_URL || "http://localhost:3000";
    const template = getSupportReplyTemplate({
      name: user.name,
      ticketId,
      subject,
      replyExcerpt: replyText.length > 200 ? `${replyText.slice(0, 200)}...` : replyText,
      ticketUrl: `${webUrl}/app/support/${ticketId}`,
    });

    return this.sendEmail({
      to: user.email,
      userId: user.id,
      type: "SUPPORT_REPLY",
      subject: template.subject,
      html: template.html,
      text: template.text,
      idempotencyKey: `ticket_reply_${ticketId}_${Date.now()}`,
    });
  }

  /**
   * Health & Telemetry metrics for Admin Dashboard
   */
  async getEmailTelemetry() {
    const today = new Date().toISOString().slice(0, 10);
    const counter = await this.prisma.emailDailyCounter.findUnique({
      where: { date: today },
    });

    const [totalSent, totalFailed, totalBounced, totalComplained, recentLogs] = await Promise.all([
      this.prisma.emailLog.count({ where: { status: { in: ["SENT", "DELIVERED"] } } }),
      this.prisma.emailLog.count({ where: { status: "FAILED" } }),
      this.prisma.emailLog.count({ where: { status: "BOUNCED" } }),
      this.prisma.emailLog.count({ where: { status: "COMPLAINED" } }),
      this.prisma.emailLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          to: true,
          type: true,
          status: true,
          providerMessageId: true,
          error: true,
          createdAt: true,
        },
      }),
    ]);

    const dailyUsage = counter?.count || 0;
    return {
      provider: this.provider.name,
      dailyQuota: {
        used: dailyUsage,
        limit: DAILY_LIMIT,
        percent: Math.round((dailyUsage / DAILY_LIMIT) * 100),
        status: dailyUsage >= DAILY_LIMIT ? "EXCEEDED" : dailyUsage >= WARNING_THRESHOLD ? "WARNING" : "HEALTHY",
      },
      stats: {
        totalSent,
        totalFailed,
        totalBounced,
        totalComplained,
      },
      recentLogs,
    };
  }
}
