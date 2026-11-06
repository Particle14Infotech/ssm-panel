import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException
} from "@nestjs/common";
import * as crypto from "node:crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../../common/prisma.service";
import { WalletService } from "../../wallet/wallet.service";
import { TransactionType, YoupiTopUpStatus } from "@prisma/client";
import { smmLogger } from "../../../common/logger";
import {
  YoupiPilotSettings,
  YoupiCreateOrderResponse,
  YoupiWebhookPayload,
  normalizeUtr,
  maskUtr
} from "./youpi.types";

const DEFAULT_SETTINGS: YoupiPilotSettings = {
  enabled: false,
  killSwitch: false,
  allowlistUserIds: ["usr_bholu_local_id"],
  receivingUpiIds: ["merchant@upi"],
  minAmountPaise: 10000, // ₹100
  maxAmountPaise: 500000, // ₹5,000 (pilot limit)
  maxDailyAttemptsPerAccount: 20, // YouPI README guideline hard cap
  maxDailyCreditPaisePerAccount: 4000000, // ₹40,000
  maxUserDailyAttempts: 3,
  maxUserDailyAmountPaise: 500000, // ₹5,000
  secondApprovalThresholdPaise: 200000, // ₹2,000
  sessionExpirySeconds: 300, // 5 minutes
  webhookReplayWindowSeconds: 3600 // 1 hour
};

@Injectable()
export class YoupiService {
  private customFetch: typeof fetch = fetch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService
  ) {}

  /**
   * For testing: allow injecting a stub fetch client.
   */
  setFetchClient(stubFetch: typeof fetch) {
    this.customFetch = stubFetch;
  }

  /**
   * Load current pilot settings from SystemSetting or fallback to defaults.
   */
  async getSettings(): Promise<YoupiPilotSettings> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: "youpi_pilot_settings" }
      });
      if (setting && setting.value) {
        return { ...DEFAULT_SETTINGS, ...(setting.value as any) };
      }
    } catch (err: any) {
      smmLogger.warn(`[YoupiService] Could not read settings: ${err.message}`);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Update pilot settings. Enforces that `enabled: true` requires pilotAcknowledgement.
   */
  async updateSettings(updates: Partial<YoupiPilotSettings>, adminName: string): Promise<YoupiPilotSettings> {
    const current = await this.getSettings();
    const next: YoupiPilotSettings = { ...current, ...updates };

    // Enforce README guideline hard ceiling: daily attempts per account cannot exceed 20 unless explicitly overridden with a written note
    if (next.maxDailyAttemptsPerAccount > 20 && (!next.pilotAcknowledgement || !next.pilotAcknowledgement.statement)) {
      throw new BadRequestException(
        "Increasing daily attempts per account beyond 20 requires a signed pilot acknowledgement note."
      );
    }

    // Flag cannot be enabled until pilot acknowledgement exists
    if (next.enabled && (!next.pilotAcknowledgement || !next.pilotAcknowledgement.confirmedAt)) {
      throw new BadRequestException(
        "Pilot payment method cannot be enabled without a recorded pilot acknowledgement confirming bank and compliance review."
      );
    }

    await this.prisma.systemSetting.upsert({
      where: { key: "youpi_pilot_settings" },
      update: { value: next as any },
      create: { key: "youpi_pilot_settings", value: next as any }
    });

    smmLogger.info(`[YoupiService] Settings updated by ${adminName}`);
    return next;
  }

  /**
   * Records the mandatory pilot acknowledgement statement from an administrator.
   */
  async recordAcknowledgement(adminName: string, statement: string): Promise<YoupiPilotSettings> {
    if (!statement || statement.trim().length < 20) {
      throw new BadRequestException("Acknowledgement statement must be at least 20 characters.");
    }
    return await this.updateSettings({
      pilotAcknowledgement: {
        adminName,
        confirmedAt: new Date().toISOString(),
        statement: statement.trim()
      }
    }, adminName);
  }

  /**
   * Evaluates whether YouPI pilot top-up is allowed for a given user.
   */
  async checkEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
    const settings = await this.getSettings();

    if (settings.killSwitch) {
      return { eligible: false, reason: "UPI payment pilot is temporarily paused by administration." };
    }
    if (!settings.enabled) {
      return { eligible: false, reason: "UPI payment pilot is currently disabled." };
    }
    if (!settings.allowlistUserIds || !settings.allowlistUserIds.includes(userId)) {
      return { eligible: false, reason: "UPI payment pilot is restricted to allowlisted pilot participants." };
    }

    return { eligible: true };
  }

  /**
   * Creates a new YouPI Top-Up Session for wallet credit.
   */
  async createTopUp(userId: string, amountRupees: number): Promise<{
    orderRef: string;
    amountRupees: number;
    amountPaise: number;
    currency: string;
    checkoutUrl: string;
    queuePosition: number;
    expiresAt: string;
    receivingUpiId: string;
  }> {
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.eligible) {
      throw new ForbiddenException(eligibility.reason || "Payment method not available.");
    }

    const settings = await this.getSettings();

    if (!amountRupees || amountRupees <= 0 || isNaN(amountRupees)) {
      throw new BadRequestException("A valid positive amount is required.");
    }

    const amountPaise = Math.round(amountRupees * 100);

    if (amountPaise < settings.minAmountPaise || amountPaise > settings.maxAmountPaise) {
      throw new BadRequestException(
        `Amount must be between ₹${settings.minAmountPaise / 100} and ₹${settings.maxAmountPaise / 100}.`
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Enforce per-user daily attempt cap
    const userTodayAttempts = await this.prisma.youpiTopUp.count({
      where: {
        userId,
        createdAt: { gte: todayStart }
      }
    });
    if (userTodayAttempts >= settings.maxUserDailyAttempts) {
      throw new BadRequestException(`You have reached the maximum daily limit of ${settings.maxUserDailyAttempts} attempts.`);
    }

    // Enforce per-user daily amount cap
    const userTodayCredited = await this.prisma.youpiTopUp.aggregate({
      where: {
        userId,
        status: YoupiTopUpStatus.CREDITED,
        createdAt: { gte: todayStart }
      },
      _sum: { amountPaise: true }
    });
    const currentCreditedPaise = userTodayCredited._sum.amountPaise || 0;
    if (currentCreditedPaise + amountPaise > settings.maxUserDailyAmountPaise) {
      throw new BadRequestException(
        `This payment would exceed your maximum daily deposit limit of ₹${settings.maxUserDailyAmountPaise / 100}.`
      );
    }

    // Enforce global receiving account daily attempt cap (README guideline: max 20 attempts/day)
    const globalTodayAttempts = await this.prisma.youpiTopUp.count({
      where: {
        createdAt: { gte: todayStart }
      }
    });
    if (globalTodayAttempts >= settings.maxDailyAttemptsPerAccount) {
      throw new ServiceUnavailableException(
        "The daily capacity for the UPI pilot receiving account has been reached. Please try again tomorrow or use another payment method."
      );
    }

    const orderRef = `youpi_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const expiresAtDate = new Date(Date.now() + settings.sessionExpirySeconds * 1000);

    // Create local record with status INITIATED
    const topUp = await this.prisma.youpiTopUp.create({
      data: {
        userId,
        orderRef,
        amountPaise,
        currency: "INR",
        status: YoupiTopUpStatus.INITIATED,
        expiresAt: expiresAtDate
      }
    });

    const baseUrl = process.env.YOUPI_BASE_URL || "http://127.0.0.1:6100";
    const merchantId = process.env.YOUPI_MERCHANT_PUBLIC_KEY || "00000000-0000-0000-0000-000000000001";
    const apiKey = process.env.YOUPI_API_KEY || "";
    const portalUrl = process.env.YOUPI_PORTAL_PUBLIC_URL || baseUrl;

    let checkoutUrl = `${portalUrl}/checkout/${topUp.id}`;
    let queuePosition = 0;
    let gatewaySessionId = topUp.id;

    // Dispatch to YouPI upstream API
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Merchant-Id": merchantId,
        "Idempotency-Key": `idem_${orderRef}`
      };
      if (apiKey) {
        headers["X-Merchant-Key"] = apiKey;
      }

      const res = await this.customFetch(`${baseUrl}/api/v1/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId: orderRef,
          amount: (amountPaise / 100).toFixed(2),
          currency: "INR",
          method: "MANUAL_UPI",
          returnUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/wallet/topup/complete?ref=${orderRef}`
        })
      });

      if (res.status === 409) {
        const conflict = (await res.json().catch(() => ({}))) as any;
        if (conflict && conflict.code === "ORDER_AMOUNT_MISMATCH") {
          throw new ConflictException("Order reference amount mismatch on payment gateway.");
        }
      }

      if (res.ok) {
        const data = (await res.json()) as YoupiCreateOrderResponse;
        gatewaySessionId = data.paymentId || topUp.id;
        checkoutUrl = data.checkoutUrl || checkoutUrl;
      }
    } catch (err: any) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      smmLogger.warn(`[YoupiService] Upstream gateway call warning: ${err.message}; proceeding with local session`);
    }

    await this.prisma.youpiTopUp.update({
      where: { id: topUp.id },
      data: {
        status: YoupiTopUpStatus.AWAITING_PAYMENT,
        gatewaySessionId,
        queuePosition
      }
    });

    return {
      orderRef,
      amountRupees: amountPaise / 100,
      amountPaise,
      currency: "INR",
      checkoutUrl,
      queuePosition,
      expiresAt: expiresAtDate.toISOString(),
      receivingUpiId: settings.receivingUpiIds[0] || "merchant@upi"
    };
  }

  /**
   * Validates raw bytes HMAC-SHA256 signatures for incoming webhooks.
   * Compares timing-safe both V1 and V2 (if present) signatures.
   */
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): {
    valid: boolean;
    reason?: string;
  } {
    const secret = process.env.YOUPI_WEBHOOK_SECRET;
    if (!secret) {
      smmLogger.error("[YoupiService] YOUPI_WEBHOOK_SECRET is not configured.");
      return { valid: false, reason: "Server configuration missing" };
    }

    // Normalize header keys to lowercase
    const getHeader = (key: string): string | null => {
      const val = headers[key.toLowerCase()] || headers[key];
      if (Array.isArray(val)) return val[0] || null;
      return typeof val === "string" ? val : null;
    };

    const sigV1 = getHeader("X-Gateway-Signature");
    const sigV2 = getHeader("X-Gateway-Signature-V2");
    const timestampStr = getHeader("X-Gateway-Timestamp");

    if (!sigV1) {
      return { valid: false, reason: "Missing X-Gateway-Signature header" };
    }

    const cleanSigV1 = sigV1.startsWith("sha256=") ? sigV1.slice(7) : sigV1;
    const hmacV1 = crypto.createHmac("sha256", secret);
    hmacV1.update(rawBody);
    const expectedSigV1 = hmacV1.digest("hex");

    let isV1Valid = false;
    try {
      const expectedBuf = Buffer.from(expectedSigV1, "hex");
      const actualBuf = Buffer.from(cleanSigV1, "hex");
      if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        isV1Valid = true;
      }
    } catch {
      isV1Valid = false;
    }

    if (!isV1Valid) {
      return { valid: false, reason: "Invalid V1 signature" };
    }

    // If V2 signature and timestamp are provided, verify timestamp window and V2 signature
    if (sigV2 && timestampStr) {
      const timestamp = Number(timestampStr);
      if (isNaN(timestamp)) {
        return { valid: false, reason: "Invalid timestamp header" };
      }

      // Check replay window (1 hour = 3,600,000 ms)
      const now = Date.now();
      const replayWindowMs = (DEFAULT_SETTINGS.webhookReplayWindowSeconds || 3600) * 1000;
      if (Math.abs(now - timestamp) > replayWindowMs) {
        return { valid: false, reason: "Webhook timestamp outside replay window" };
      }

      const cleanSigV2 = sigV2.startsWith("sha256=") ? sigV2.slice(7) : sigV2;
      const hmacV2 = crypto.createHmac("sha256", secret);
      hmacV2.update(`${timestampStr}.${rawBody.toString("utf8")}`);
      const expectedSigV2 = hmacV2.digest("hex");

      try {
        const expectedV2Buf = Buffer.from(expectedSigV2, "hex");
        const actualV2Buf = Buffer.from(cleanSigV2, "hex");
        if (expectedV2Buf.length !== actualV2Buf.length || !crypto.timingSafeEqual(expectedV2Buf, actualV2Buf)) {
          return { valid: false, reason: "Invalid V2 signature" };
        }
      } catch {
        return { valid: false, reason: "Invalid V2 signature buffer comparison" };
      }
    }

    return { valid: true };
  }

  /**
   * Processes an incoming YouPI webhook.
   * Handles deliveryId deduplication, event routing, and wallet crediting invariants.
   */
  async handleWebhookDelivery(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    payload: YoupiWebhookPayload
  ): Promise<{ status: string; deliveryId: string; credited: boolean }> {
    // 1. Verify signatures over raw bytes
    const sigCheck = this.verifyWebhookSignature(rawBody, headers);
    if (!sigCheck.valid) {
      throw new UnauthorizedException("Unauthorized");
    }

    const deliveryId = payload.deliveryId || (headers["x-gateway-delivery-id"] as string);
    if (!deliveryId) {
      throw new BadRequestException("Missing deliveryId");
    }

    const rawBodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");

    // 2. Insert write-ahead delivery record with unique constraint lock
    try {
      await this.prisma.youpiWebhookDelivery.create({
        data: {
          deliveryId,
          event: payload.event,
          signatureOk: true,
          rawBodyHash,
          processedAt: null,
          result: "PROCESSING"
        }
      });
    } catch (err: any) {
      // P2002 is Prisma's unique constraint violation code
      if (
        err?.code === "P2002" ||
        String(err?.message || "").includes("Unique constraint") ||
        String(err?.message || "").includes("UNIQUE")
      ) {
        smmLogger.info(`[YoupiService] Duplicate deliveryId ignored: ${deliveryId}`);
        return { status: "duplicate", deliveryId, credited: false };
      }
      throw err;
    }

    let credited = false;
    let resultOutcome = "PROCESSED";

    try {
      // 4. Process event in ONE database transaction
      await this.prisma.$transaction(async (tx) => {
        const topUp = await tx.youpiTopUp.findUnique({
          where: { orderRef: payload.orderId }
        });

        // Event: OBSERVED_SUCCESS
        // Upstream UPI alert detected. NEVER CREDIT WALLET on this event.
        if (payload.event === "OBSERVED_SUCCESS") {
          if (topUp) {
            await tx.youpiObservation.create({
              data: {
                topUpId: topUp.id,
                amountPaise: payload.amountPaise,
                utr: payload.utr || "UNKNOWN",
                source: "OBSERVER_ALERT"
              }
            });
            if (topUp.status === YoupiTopUpStatus.INITIATED || topUp.status === YoupiTopUpStatus.AWAITING_PAYMENT) {
              await tx.youpiTopUp.update({
                where: { id: topUp.id },
                data: {
                  status: YoupiTopUpStatus.OBSERVED,
                  utr: payload.utr || null,
                  normalizedUtr: normalizeUtr(payload.utr)
                }
              });
            }
          }
          resultOutcome = "OBSERVED_SAVED_NO_CREDIT";
          return;
        }

        // Event: MANUAL_REVIEW (Customer submitted UTR claim in checkout)
        if (payload.event === "MANUAL_REVIEW" || payload.event === "CUSTOMER_UTR_SUBMITTED") {
          if (topUp && payload.utr) {
            await tx.youpiObservation.create({
              data: {
                topUpId: topUp.id,
                amountPaise: payload.amountPaise || topUp.amountPaise,
                utr: payload.utr,
                source: "CUSTOMER_MANUAL_CLAIM"
              }
            });
            await tx.youpiTopUp.update({
              where: { id: topUp.id },
              data: {
                status: YoupiTopUpStatus.OBSERVED,
                utr: payload.utr,
                normalizedUtr: normalizeUtr(payload.utr)
              }
            });
          }
          resultOutcome = "MANUAL_REVIEW_FLAGGED_NO_CREDIT";
          return;
        }

        // Event: RECONCILED (Bank statement matched this payment)
        if (payload.event === "RECONCILED") {
          if (!topUp) {
            smmLogger.warn(`[YoupiService] RECONCILED event for unknown orderRef: ${payload.orderId}`);
            resultOutcome = "UNKNOWN_ORDER_REF_SUSPICIOUS";
            return;
          }

          // Guard: Method must be UPI and settlementState must be RECONCILED
          if (payload.settlementState !== "RECONCILED") {
            smmLogger.warn(`[YoupiService] RECONCILED event without settlementState RECONCILED`);
            return;
          }

          // Guard: Exact amount and currency match
          if (topUp.amountPaise !== payload.amountPaise || (payload.currency && payload.currency !== topUp.currency)) {
            await tx.youpiTopUp.update({
              where: { id: topUp.id },
              data: { status: YoupiTopUpStatus.SUSPICIOUS }
            });
            resultOutcome = "AMOUNT_MISMATCH_SUSPICIOUS";
            return;
          }

          // Guard: Top-up not already CREDITED or REJECTED
          if (topUp.status === YoupiTopUpStatus.CREDITED) {
            resultOutcome = "ALREADY_CREDITED";
            return;
          }
          if (topUp.status === YoupiTopUpStatus.REJECTED) {
            resultOutcome = "REJECTED_TOPUP_IGNORED";
            return;
          }

          const normUtr = normalizeUtr(payload.utr);
          if (!normUtr) {
            await tx.youpiTopUp.update({
              where: { id: topUp.id },
              data: { status: YoupiTopUpStatus.SUSPICIOUS }
            });
            resultOutcome = "MISSING_UTR_SUSPICIOUS";
            return;
          }

          // Guard: Unique normalized UTR among credited top-ups
          const duplicateCredited = await tx.youpiTopUp.findFirst({
            where: {
              normalizedUtr: normUtr,
              status: YoupiTopUpStatus.CREDITED,
              id: { not: topUp.id }
            }
          });
          if (duplicateCredited) {
            await tx.youpiTopUp.update({
              where: { id: topUp.id },
              data: { status: YoupiTopUpStatus.SUSPICIOUS }
            });
            resultOutcome = "DUPLICATE_UTR_SUSPICIOUS";
            return;
          }

          // Atomically lock wallet row and credit wallet
          const [wallet] = await tx.$queryRawUnsafe<any[]>(
            `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
            topUp.userId
          );
          if (!wallet) {
            throw new BadRequestException("Wallet not found for top-up user.");
          }

          const amountDecimal = new Decimal(topUp.amountPaise).dividedBy(100);

          // Calculate standard promotional bonus
          let bonusPaise = 0;
          if (topUp.amountPaise >= 500000) bonusPaise = Math.round(topUp.amountPaise * 0.15);
          else if (topUp.amountPaise >= 100000) bonusPaise = Math.round(topUp.amountPaise * 0.10);
          else if (topUp.amountPaise >= 50000) bonusPaise = Math.round(topUp.amountPaise * 0.05);

          const totalPaise = topUp.amountPaise + bonusPaise;
          const totalDecimal = new Decimal(totalPaise).dividedBy(100);

          // Check if ledger entry already exists for this top-up
          const existingLedger = await tx.ledgerEntry.findFirst({
            where: { referenceId: topUp.orderRef }
          });
          if (!existingLedger) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: totalDecimal } }
            });

            await tx.ledgerEntry.create({
              data: {
                walletId: wallet.id,
                amount: totalDecimal,
                type: TransactionType.DEPOSIT,
                referenceId: topUp.orderRef,
                description: `Deposit via UPI (Ref: ${maskUtr(normUtr)})`
              }
            });
          }

          await tx.youpiTopUp.update({
            where: { id: topUp.id },
            data: {
              status: YoupiTopUpStatus.CREDITED,
              utr: payload.utr,
              normalizedUtr: normUtr,
              creditedAt: new Date()
            }
          });

          credited = true;
          resultOutcome = "RECONCILED_WALLET_CREDITED";
          return;
        }

        // Terminal Events: FAILED, EXPIRED, CANCELLED
        if (payload.event === "EXPIRED" && topUp) {
          await tx.youpiTopUp.update({
            where: { id: topUp.id },
            data: { status: YoupiTopUpStatus.EXPIRED }
          });
          resultOutcome = "EXPIRED";
        } else if (payload.event === "FAILED" && topUp) {
          await tx.youpiTopUp.update({
            where: { id: topUp.id },
            data: { status: YoupiTopUpStatus.REJECTED }
          });
          resultOutcome = "FAILED";
        }
      });
    } catch (err: any) {
      smmLogger.error(`[YoupiService] Webhook processing error: ${err.message}`);
      resultOutcome = `ERROR: ${err.message}`;
      throw err;
    } finally {
      await this.prisma.youpiWebhookDelivery.update({
        where: { deliveryId },
        data: {
          processedAt: new Date(),
          result: resultOutcome
        }
      });
    }

    return { status: resultOutcome, deliveryId, credited };
  }

  /**
   * Admin Manual Confirmation Path.
   * Confirms payment against direct bank app check or uploaded statement row.
   */
  async confirmTopUp(
    topUpId: string,
    actorId: string,
    reason: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; topUpId: string; creditedAmountPaise: number }> {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException("A valid justification reason of at least 10 characters is required.");
    }

    const settings = await this.getSettings();

    return await this.prisma.$transaction(async (tx) => {
      const topUp = await tx.youpiTopUp.findUnique({
        where: { id: topUpId }
      });
      if (!topUp) {
        throw new NotFoundException("Top-up record not found.");
      }

      if (topUp.status === YoupiTopUpStatus.CREDITED) {
        return { success: true, topUpId: topUp.id, creditedAmountPaise: topUp.amountPaise };
      }
      if (topUp.status === YoupiTopUpStatus.REJECTED) {
        throw new BadRequestException("Cannot confirm a rejected top-up.");
      }

      // Check second-approval threshold rule
      if (topUp.amountPaise >= settings.secondApprovalThresholdPaise) {
        const priorReview = await tx.topUpReview.findFirst({
          where: { topUpId: topUp.id, decision: "PENDING_SECOND_APPROVAL" }
        });
        if (!priorReview) {
          // Record first approval
          await tx.topUpReview.create({
            data: {
              topUpId: topUp.id,
              actorId,
              decision: "PENDING_SECOND_APPROVAL",
              reason: `Stage 1 Approval: ${reason.trim()}`
            }
          });
          return {
            success: true,
            topUpId: topUp.id,
            creditedAmountPaise: 0
          };
        }
        if (priorReview.actorId === actorId) {
          throw new ForbiddenException(
            "Dual-control policy: Second approval must be performed by a different administrator."
          );
        }
      }

      // Record confirmation in append-only TopUpReview table
      await tx.topUpReview.create({
        data: {
          topUpId: topUp.id,
          actorId,
          decision: "CONFIRMED",
          reason: reason.trim()
        }
      });

      // Lock user's wallet
      const [wallet] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        topUp.userId
      );
      if (!wallet) {
        throw new BadRequestException("User wallet not found.");
      }

      // Calculate standard bonus
      let bonusPaise = 0;
      if (topUp.amountPaise >= 500000) bonusPaise = Math.round(topUp.amountPaise * 0.15);
      else if (topUp.amountPaise >= 100000) bonusPaise = Math.round(topUp.amountPaise * 0.10);
      else if (topUp.amountPaise >= 50000) bonusPaise = Math.round(topUp.amountPaise * 0.05);

      const totalPaise = topUp.amountPaise + bonusPaise;
      const totalDecimal = new Decimal(totalPaise).dividedBy(100);

      // Unique ledger reference check
      const existingLedger = await tx.ledgerEntry.findFirst({
        where: { referenceId: topUp.orderRef }
      });
      if (!existingLedger) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: totalDecimal } }
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            amount: totalDecimal,
            type: TransactionType.DEPOSIT,
            referenceId: topUp.orderRef,
            description: `Deposit via UPI (Manual Bank Confirm: ${maskUtr(topUp.normalizedUtr)})`
          }
        });
      }

      await tx.youpiTopUp.update({
        where: { id: topUp.id },
        data: {
          status: YoupiTopUpStatus.CREDITED,
          creditedAt: new Date()
        }
      });

      return {
        success: true,
        topUpId: topUp.id,
        creditedAmountPaise: totalPaise
      };
    });
  }

  /**
   * Admin Manual Rejection Path.
   */
  async rejectTopUp(topUpId: string, actorId: string, reason: string): Promise<{ success: boolean; topUpId: string }> {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException("A valid rejection reason of at least 10 characters is required.");
    }

    return await this.prisma.$transaction(async (tx) => {
      const topUp = await tx.youpiTopUp.findUnique({
        where: { id: topUpId }
      });
      if (!topUp) {
        throw new NotFoundException("Top-up record not found.");
      }
      if (topUp.status === YoupiTopUpStatus.CREDITED) {
        throw new BadRequestException("Cannot reject an already credited top-up.");
      }

      await tx.topUpReview.create({
        data: {
          topUpId: topUp.id,
          actorId,
          decision: "REJECTED",
          reason: reason.trim()
        }
      });

      await tx.youpiTopUp.update({
        where: { id: topUp.id },
        data: { status: YoupiTopUpStatus.REJECTED }
      });

      return { success: true, topUpId: topUp.id };
    });
  }

  /**
   * Bank Statement CSV Import and Reconciliation Engine.
   * Validates file hash to prevent duplicate imports and matches rows against OBSERVED top-ups.
   */
  async importBankStatement(uploadedBy: string, csvContent: string): Promise<{
    importId: string;
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    matchedTopUpIds: string[];
  }> {
    if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
      throw new BadRequestException("CSV content is required.");
    }

    const fileHash = crypto.createHash("sha256").update(csvContent).digest("hex");

    const existingImport = await this.prisma.bankStatementImport.findUnique({
      where: { fileHash }
    });
    if (existingImport) {
      throw new ConflictException("This statement file has already been imported.");
    }

    // Split rows and parse
    const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException("CSV must contain at least a header and one data row.");
    }

    // Expected format: Date,UTR,Amount
    const dataLines = lines.slice(1);
    let matchedCount = 0;
    let unmatchedCount = 0;
    const matchedTopUpIds: string[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const statementImport = await tx.bankStatementImport.create({
        data: {
          uploadedBy,
          fileHash,
          rowCount: dataLines.length
        }
      });

      for (const line of dataLines) {
        const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length < 3) continue;

        // Escape potential CSV formula injection: =, +, -, @
        const rawDate = parts[0].replace(/^[=+\-@]/, "");
        const rawUtr = parts[1].replace(/^[=+\-@]/, "");
        const rawAmt = parts[2].replace(/^[=+\-@]/, "");

        const normalized = normalizeUtr(rawUtr);
        const amountPaise = Math.round(parseFloat(rawAmt) * 100);
        const dateObj = new Date(rawDate);

        if (!normalized || isNaN(amountPaise) || isNaN(dateObj.getTime())) {
          continue;
        }

        // Search for matching top-up with OBSERVED status
        const candidateTopUp = await tx.youpiTopUp.findFirst({
          where: {
            normalizedUtr: normalized,
            amountPaise,
            status: YoupiTopUpStatus.OBSERVED
          }
        });

        let matchedTopUpId: string | null = null;

        if (candidateTopUp) {
          // Verify unique normalized UTR among credited top-ups
          const duplicateCredited = await tx.youpiTopUp.findFirst({
            where: {
              normalizedUtr: normalized,
              status: YoupiTopUpStatus.CREDITED,
              id: { not: candidateTopUp.id }
            }
          });

          if (!duplicateCredited) {
            matchedTopUpId = candidateTopUp.id;
            matchedCount++;
            matchedTopUpIds.push(candidateTopUp.id);

            // Lock user wallet and credit
            const [wallet] = await tx.$queryRawUnsafe<any[]>(
              `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
              candidateTopUp.userId
            );
            if (wallet) {
              const amountDecimal = new Decimal(candidateTopUp.amountPaise).dividedBy(100);
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amountDecimal } }
              });

              await tx.ledgerEntry.create({
                data: {
                  walletId: wallet.id,
                  amount: amountDecimal,
                  type: TransactionType.DEPOSIT,
                  referenceId: candidateTopUp.orderRef,
                  description: `Deposit via UPI (Bank Statement Import: ${maskUtr(normalized)})`
                }
              });

              await tx.youpiTopUp.update({
                where: { id: candidateTopUp.id },
                data: {
                  status: YoupiTopUpStatus.CREDITED,
                  creditedAt: new Date()
                }
              });
            }
          }
        } else {
          unmatchedCount++;
        }

        await tx.bankStatementRow.create({
          data: {
            importId: statementImport.id,
            utr: rawUtr,
            normalizedUtr: normalized,
            amountPaise,
            date: dateObj,
            matchedTopUpId
          }
        });
      }

      return {
        importId: statementImport.id,
        totalRows: dataLines.length,
        matchedCount,
        unmatchedCount,
        matchedTopUpIds
      };
    });

    return result;
  }

  /**
   * Background Expiry Job: Expires stale INITIATED or AWAITING_PAYMENT top-ups.
   */
  async expireStaleTopUps(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.youpiTopUp.updateMany({
      where: {
        status: { in: [YoupiTopUpStatus.INITIATED, YoupiTopUpStatus.AWAITING_PAYMENT] },
        expiresAt: { lte: now }
      },
      data: {
        status: YoupiTopUpStatus.EXPIRED
      }
    });
    return result.count;
  }
}
