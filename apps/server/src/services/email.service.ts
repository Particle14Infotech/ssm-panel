import { PrismaLike } from "../prisma";
import crypto from "crypto";

const DAILY_LIMIT = 100;
const WARNING_THRESHOLD = 80;

export class EmailService {
  constructor(private readonly prisma: PrismaLike) {}

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) return true;

    const svixId = headers["svix-id"] || headers["webhook-id"];
    const svixTimestamp = headers["svix-timestamp"] || headers["webhook-timestamp"];
    const svixSignature = headers["svix-signature"] || headers["webhook-signature"];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return false;
    }

    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const tsSeconds = parseInt(svixTimestamp, 10);
      if (Math.abs(nowSeconds - tsSeconds) > 300) {
        return false;
      }

      const cleanKey = webhookSecret.startsWith("whsec_") ? webhookSecret.substring(6) : webhookSecret;
      const keyBuffer = Buffer.from(cleanKey, "base64");

      const signaturePayload = `${svixId}.${svixTimestamp}.${rawBody}`;
      const expectedSignature = crypto.createHmac("sha256", keyBuffer).update(signaturePayload).digest("base64");
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

  async handleWebhookEvent(event: any): Promise<{ handled: boolean; action?: string }> {
    const eventType = event.type;
    const data = event.data;
    const emailId = data?.email_id;
    const recipient = Array.isArray(data?.to) ? data.to[0] : data?.to;

    const client = this.prisma.client || this.prisma;
    if (eventType === "email.delivered" && emailId) {
      if (this.prisma.isConnected && client.emailLog?.updateMany) {
        await client.emailLog.updateMany({
          where: { providerMessageId: emailId },
          data: { status: "DELIVERED" },
        });
      }
      return { handled: true, action: "MARKED_DELIVERED" };
    }

    if (eventType === "email.bounced" && recipient) {
      if (emailId && this.prisma.isConnected && client.emailLog?.updateMany) {
        await client.emailLog.updateMany({
          where: { providerMessageId: emailId },
          data: { status: "BOUNCED", error: data?.bounce?.message || "Hard bounce received" },
        });
      }
      if (this.prisma.isConnected && client.emailSuppression?.upsert) {
        await client.emailSuppression.upsert({
          where: { email: recipient.toLowerCase().trim() },
          update: { reason: "BOUNCE" },
          create: { email: recipient.toLowerCase().trim(), reason: "BOUNCE" },
        });
      }
      return { handled: true, action: "SUPPRESSED_BOUNCE" };
    }

    if (eventType === "email.complained" && recipient) {
      if (emailId && this.prisma.isConnected && client.emailLog?.updateMany) {
        await client.emailLog.updateMany({
          where: { providerMessageId: emailId },
          data: { status: "COMPLAINED", error: "Spam complaint received" },
        });
      }
      if (this.prisma.isConnected && client.emailSuppression?.upsert) {
        await client.emailSuppression.upsert({
          where: { email: recipient.toLowerCase().trim() },
          update: { reason: "COMPLAINT" },
          create: { email: recipient.toLowerCase().trim(), reason: "COMPLAINT" },
        });
      }
      return { handled: true, action: "SUPPRESSED_COMPLAINT" };
    }

    return { handled: true, action: "NOOP" };
  }

  async getEmailTelemetry() {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.emailLog?.count) {
      return {
        provider: "LogOnlyEmailProvider",
        dailyQuota: {
          used: 0,
          limit: DAILY_LIMIT,
          percent: 0,
          status: "HEALTHY",
        },
        stats: {
          totalSent: 0,
          totalFailed: 0,
          totalBounced: 0,
          totalComplained: 0,
        },
        recentLogs: [],
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const counter = client.emailDailyCounter?.findUnique
      ? await client.emailDailyCounter.findUnique({ where: { date: today } })
      : null;

    const [totalSent, totalFailed, totalBounced, totalComplained, recentLogs] = await Promise.all([
      client.emailLog.count({ where: { status: { in: ["SENT", "DELIVERED"] } } }),
      client.emailLog.count({ where: { status: "FAILED" } }),
      client.emailLog.count({ where: { status: "BOUNCED" } }),
      client.emailLog.count({ where: { status: "COMPLAINED" } }),
      client.emailLog.findMany({
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
      provider: process.env.RESEND_API_KEY ? "Resend" : "LogOnlyEmailProvider",
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
