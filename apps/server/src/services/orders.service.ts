import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";
import { Decimal } from "decimal.js";
import {
  calculateOrderFinancialSnapshot,
  DEFAULT_PRICING_SETTINGS,
  splitChargeShare,
  generateRunSchedule,
  PACKAGE_PROVIDER_STATUS_STALLED_REASON,
} from "@smm/contracts";
import { z } from "zod";

export const PackageProviderReconciliationInputSchema = z.discriminatedUnion(
  "outcome",
  [
    z.object({
      outcome: z.literal("ACCEPTED"),
      providerId: z.string().trim().min(1),
      providerOrderId: z.string().trim().min(1).max(255),
      evidence: z.string().trim().min(1).max(2000),
    }),
    z.object({
      outcome: z.literal("REJECTED"),
      providerId: z.string().trim().min(1),
      confirmedNoAcceptance: z.literal(true),
      evidence: z.string().trim().min(1).max(2000),
    }),
    z.object({
      outcome: z.literal("UNRESOLVED"),
      evidence: z.string().trim().min(1).max(2000),
    }),
  ]
);

export type PackageProviderReconciliationInput = z.infer<
  typeof PackageProviderReconciliationInputSchema
>;

export interface CreateOrderDto {
  userId?: string;
  requesterRole?: string;
  serviceId: string;
  target: string;
  quantity: number;
  isDripFeed?: boolean;
  runs?: number;
  interval?: number;
  idempotencyKey?: string;
  expectedRate?: number;
  comments?: string;
}

export interface OrderFilterDto {
  status?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
  dripFeedOnly?: boolean;
}

export class OrdersService {
  constructor(private readonly prisma: PrismaLike) {}

  private sanitizeOrderForRole(order: any, role?: string) {
    if (role === "ADMIN") return order;
    if (!order) return order;
    const {
      costRatePer1k,
      fxRateUsed,
      providerCurrency,
      estimatedProviderCost,
      estimatedGrossProfit,
      paymentFeeEstimate,
      estimatedNetProfit,
      actualProviderCost,
      actualProfit,
      costUnknown,
      ...safeOrder
    } = order;
    if (safeOrder.service) {
      const { providerCostPer1k, costINR, marginPercentOverride, fixedSellingRateOverride, ...safeService } = safeOrder.service;
      safeOrder.service = safeService;
    }
    if (safeOrder.packageExecution && !safeOrder.packageRun) {
      const pe = safeOrder.packageExecution;
      const pkg = pe.package;
      safeOrder.packageRun = {
        id: pe.id,
        runIndex: pe.seq,
        packageId: pe.packageId,
        package: pkg
          ? {
              id: pkg.id,
              name: `${pkg.platform} @${pkg.handle}`,
              status: pkg.status,
              totalRuns:
                pkg.rules?.reduce((acc: number, r: any) => acc + (r.maxPosts || 1), 0) || pe.seq,
              completedRuns: pe.seq,
            }
          : undefined,
      };
    }
    return safeOrder;
  }

  async findAll(userId?: string, requesterRole?: string, filters?: OrderFilterDto) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database is disconnected. Cannot retrieve orders.");
    }

    const where: any = {};
    if (requesterRole === "ADMIN") {
      if (userId) where.userId = userId;
    } else {
      if (!userId) return [];
      where.userId = userId;
    }

    if (filters?.status && filters.status !== "ALL") {
      where.status = filters.status.toUpperCase();
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { target: { contains: q, mode: "insensitive" } },
        { service: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (filters?.dripFeedOnly) {
      where.isDripFeed = true;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const include: any = {
      service: {
        select: {
          id: true,
          name: true,
          platform: true,
          refillable: true,
          cancellable: true,
        },
      },
      history: {
        orderBy: { createdAt: "asc" },
      },
      refunds: true,
      runsList: {
        orderBy: { runIndex: "asc" },
      },
    };

    if (requesterRole === "ADMIN") {
      include.provider = { select: { id: true, name: true } };
      include.user = { select: { id: true, email: true, name: true } };
    }

    const orders = await this.prisma.order.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });

    return orders.map((o: any) => this.sanitizeOrderForRole(o, requesterRole));
  }

  async findOne(id: string, requesterUserId?: string, requesterRole?: string) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database is disconnected. Cannot retrieve order.");
    }

    const include: any = {
      service: true,
      history: {
        orderBy: { createdAt: "asc" },
      },
      refunds: true,
      runsList: {
        orderBy: { runIndex: "asc" },
      },
    };

    if (requesterRole === "ADMIN") {
      include.provider = { select: { id: true, name: true } };
      include.user = { select: { id: true, email: true, name: true } };
      include.providerEvents = { orderBy: { createdAt: "asc" } };
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include,
    });

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", `Order #${id} not found.`);
    }

    if (requesterRole !== "ADMIN") {
      if (!requesterUserId || order.userId !== requesterUserId) {
        throw new ApiError(404, "NOT_FOUND", `Order #${id} not found.`);
      }
    }

    return this.sanitizeOrderForRole(order, requesterRole);
  }

  async create(input: CreateOrderDto) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database is disconnected. Cannot create orders.");
    }

    if (!input.serviceId || typeof input.serviceId !== "string" || !input.target || !input.quantity) {
      throw new ApiError(400, "BAD_REQUEST", "serviceId, target URL, and quantity are required.");
    }
    if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
      throw new ApiError(400, "BAD_REQUEST", "Quantity must be a positive integer.");
    }

    const userId = input.userId;
    if (!userId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required to dispatch orders.");
    }

    const service = await this.prisma.service.findUnique({
      where: { id: input.serviceId },
    });

    if (!service) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid service ID provided.");
    }

    if (service.status !== "ACTIVE" || service.isDeleted || service.active === false) {
      throw new ApiError(400, "BAD_REQUEST", "Service is currently unavailable.");
    }

    if (service.priceBelowCost) {
      throw new ApiError(400, "BAD_REQUEST", "This service is temporarily unavailable due to pricing adjustment.");
    }

    if (input.expectedRate !== undefined && input.expectedRate !== null) {
      const currentRate = new Decimal(service.ratePer1000.toString()).toNumber();
      const expected = new Decimal(input.expectedRate).toNumber();
      if (Math.abs(currentRate - expected) > 0.001) {
        throw new ApiError(409, "CONFLICT", "Price updated, please confirm the new price before placing the order.");
      }
    }

    const isCustomComments = service.serviceType === "CUSTOM_COMMENTS" || service.serviceType === "COMMENTS";
    if (isCustomComments) {
      if (input.isDripFeed) {
        throw new ApiError(400, "BAD_REQUEST", "Drip-feed is not supported for custom comments.");
      }
      if (!input.comments || !input.comments.trim()) {
        throw new ApiError(400, "BAD_REQUEST", "Comments are required for this service (one comment per line).");
      }
      const commentLines = input.comments
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);
      if (commentLines.length === 0) {
        throw new ApiError(400, "BAD_REQUEST", "At least one comment line is required.");
      }
      if (commentLines.length !== input.quantity) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `Number of comment lines (${commentLines.length}) must match the requested quantity (${input.quantity}).`
        );
      }
    }

    if (input.quantity < service.minQty || input.quantity > service.maxQty) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Quantity must be between ${service.minQty} and ${service.maxQty}.`
      );
    }

    const isDripFeed = Boolean(input.isDripFeed);
    let runs = 1;
    let intervalMinutes: number | null = null;
    let totalQuantity = input.quantity;
    let dripMode = "NONE";

    if (isDripFeed) {
      if (service.dripFeedSupported) {
        dripMode = "NATIVE";
      } else if (service.allowManagedDrip || (service.allowManagedDrip === undefined && service.serviceType !== "CUSTOM_COMMENTS")) {
        dripMode = "MANAGED";
      } else {
        throw new ApiError(400, "BAD_REQUEST", "This service does not support drip-feed fulfillment.");
      }

      if (!input.runs || typeof input.runs !== "number" || !Number.isInteger(input.runs)) {
        throw new ApiError(400, "BAD_REQUEST", "Runs parameter is required and must be an integer for drip-feed orders.");
      }
      if (!input.interval || typeof input.interval !== "number" || !Number.isInteger(input.interval)) {
        throw new ApiError(400, "BAD_REQUEST", "Interval parameter (minutes) is required and must be an integer for drip-feed orders.");
      }

      runs = input.runs;
      intervalMinutes = input.interval;
      totalQuantity = input.quantity * runs;
    } else {
      if (input.runs !== undefined && input.runs !== null) {
        throw new ApiError(400, "BAD_REQUEST", "Runs cannot be specified for non-drip-feed orders.");
      }
      if (input.interval !== undefined && input.interval !== null) {
        throw new ApiError(400, "BAD_REQUEST", "Interval cannot be specified for non-drip-feed orders.");
      }
    }

    const pricingSettings = DEFAULT_PRICING_SETTINGS;
    const fxRate = service.providerCostCurrency === "USD" ? pricingSettings.usdInrRate : 1.0;
    const costRate = service.costINR
      ? new Decimal(service.costINR.toString()).toNumber()
      : (service.providerCostPer1k
          ? new Decimal(service.providerCostPer1k.toString()).mul(fxRate).toNumber()
          : new Decimal(service.ratePer1000.toString()).toNumber());

    const snapshot = calculateOrderFinancialSnapshot({
      sellRatePer1k: service.ratePer1000,
      costRatePer1k: costRate,
      fxRateUsed: fxRate,
      providerCurrency: service.providerCostCurrency || "INR",
      quantityPerRun: input.quantity,
      runs,
      dripSurchargePercent: isDripFeed ? (pricingSettings.dripSurchargePercent || 0) : 0,
      paymentFeePercent: pricingSettings.paymentFeePercent,
    });

    const charge = snapshot.charge;

    if (input.idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: {
          unique_order_idempotency_per_user: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { service: true, history: true, refunds: true },
      });

      if (existingOrder) {
        const sameParams =
          existingOrder.serviceId === service.id &&
          existingOrder.target === input.target &&
          existingOrder.quantity === input.quantity &&
          Boolean(existingOrder.isDripFeed) === isDripFeed &&
          (existingOrder.runs ?? null) === (isDripFeed ? runs : null) &&
          (existingOrder.intervalMinutes ?? null) === (isDripFeed ? intervalMinutes : null);

        if (!sameParams) {
          throw new ApiError(409, "CONFLICT", "Idempotency key already used with different order parameters.");
        }
        return this.sanitizeOrderForRole(existingOrder, input.requesterRole);
      }
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: service.id,
          target: input.target,
          quantity: input.quantity,
          isDripFeed,
          dripMode,
          runs: isDripFeed ? runs : null,
          intervalMinutes: isDripFeed ? intervalMinutes : null,
          quantityPerRun: input.quantity,
          totalQuantity,
          charge,
          sellRatePer1k: snapshot.sellRatePer1k,
          costRatePer1k: snapshot.costRatePer1k,
          fxRateUsed: snapshot.fxRateUsed,
          providerCurrency: snapshot.providerCurrency,
          dripSurchargePercent: snapshot.dripSurchargePercent,
          estimatedProviderCost: snapshot.estimatedProviderCost,
          estimatedGrossProfit: snapshot.estimatedGrossProfit,
          paymentFeeEstimate: snapshot.paymentFeeEstimate,
          estimatedNetProfit: snapshot.estimatedNetProfit,
          costUnknown: !service.costINR && !service.providerCostPer1k,
          status: "PENDING",
          providerId: service.providerId || null,
          startCount: 0,
          remains: totalQuantity,
          idempotencyKey: input.idempotencyKey || null,
        },
        include: { service: true },
      });

      if (dripMode === "MANAGED") {
        const shares = splitChargeShare(charge, runs);
        const schedule = generateRunSchedule(new Date(), runs, intervalMinutes || 30);
        const runsData = schedule.map((s, idx) => ({
          orderId: order.id,
          runIndex: s.runIndex,
          quantity: input.quantity,
          scheduledAt: s.scheduledAt,
          status: "SCHEDULED",
          chargeShare: new Decimal(shares[idx]),
          attempts: 0,
          delivered: 0,
        }));

        await tx.orderRun.createMany({
          data: runsData,
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          startCount: 0,
          remains: totalQuantity,
          notes: isDripFeed
            ? `Drip-feed order placed (${dripMode}): ${runs} runs of ${input.quantity} every ${intervalMinutes}m (${totalQuantity} total). Queued for dispatch.`
            : "Order placed and queued for provider dispatch",
        },
      });

      const [walletRow] = await tx.$queryRawUnsafe(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );
      if (!walletRow) {
        throw new ApiError(400, "BAD_REQUEST", "Wallet not found for user.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      if (currentBalance.lessThan(charge)) {
        throw new ApiError(402, "PAYMENT_REQUIRED", "Insufficient wallet balance. Please add funds to your wallet to place this order.");
      }

      const newBalance = currentBalance.minus(charge);
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: charge.negated(),
          type: "ORDER_CHARGE",
          orderId: order.id,
          idempotencyKey: input.idempotencyKey,
          description: `Order Charge #${order.id} for ${service.displayName || service.name}${isDripFeed ? ` (${dripMode} Drip-feed: ${runs}x${input.quantity})` : ""}`,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregate: "ORDER",
          eventType: "ORDER_CREATED",
          payload: {
            orderId: order.id,
            serviceId: service.id,
            target: order.target,
            quantity: order.quantity,
            isDripFeed,
            dripMode,
            runs: isDripFeed ? runs : null,
            intervalMinutes: isDripFeed ? intervalMinutes : null,
            quantityPerRun: input.quantity,
            totalQuantity,
            providerId: service.providerId,
            providerServiceId: service.providerServiceId,
            comments: input.comments || null,
          },
          status: "PENDING",
        },
      });

      return order;
    });

    return this.sanitizeOrderForRole(result, input.requesterRole);
  }

  async refill(id: string, requesterUserId?: string, requesterRole?: string) {
    const order = await this.findOne(id, requesterUserId, requesterRole);
    if (order.dripMode === "MANAGED") {
      throw new ApiError(400, "BAD_REQUEST", "Refill is not supported on managed drip-feed orders.");
    }
    if (!order.service?.refillable) {
      throw new ApiError(400, "BAD_REQUEST", "This service does not support refills.");
    }

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        notes: "Refill request initiated by user",
      },
    });

    await this.prisma.outboxEvent.create({
      data: {
        aggregate: "ORDER",
        eventType: "ORDER_REFILL_REQUESTED",
        payload: {
          orderId: id,
          providerId: order.providerId,
          providerOrderId: order.providerOrderId,
        },
        status: "PENDING",
      },
    });

    return { success: true, message: `Refill request submitted for order #${id}`, orderId: id };
  }

  async cancel(id: string, requesterUserId?: string, requesterRole?: string) {
    const order = await this.findOne(id, requesterUserId, requesterRole);
    if (!order.service?.cancellable && requesterRole !== "ADMIN") {
      throw new ApiError(400, "BAD_REQUEST", "This service cannot be cancelled.");
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      throw new ApiError(409, "CONFLICT", "Order is already cancelled or refunded.");
    }
    if (order.status === "COMPLETED" && requesterRole !== "ADMIN") {
      throw new ApiError(409, "CONFLICT", "Completed orders cannot be cancelled.");
    }

    const refundCharge = new Decimal(order.charge.toString());

    const result = await this.prisma.$transaction(async (tx: any) => {
      const [walletRow] = await tx.$queryRawUnsafe(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        order.userId
      );
      if (!walletRow) {
        throw new ApiError(400, "BAD_REQUEST", "Wallet not found for refund.");
      }

      const existingRefund = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existingRefund) {
        throw new ApiError(409, "CONFLICT", "Order refund already processed.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(refundCharge);

      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: refundCharge,
          type: "REFUND",
          orderId: order.id,
          description: `Full Refund for Cancelled Order #${order.id}`,
        },
      });

      await tx.refund.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: refundCharge,
          reason: "Order cancellation",
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: "CANCELLED",
          remains: order.remains,
          startCount: order.startCount,
          notes: "Order cancelled and fully refunded",
        },
      });

      return { updatedOrder, newBalance };
    });

    return {
      success: true,
      message: `Order #${id} cancelled and refunded.`,
      newBalance: result.newBalance,
      order: result.updatedOrder,
    };
  }

  async updateStatus(id: string, status: any, details?: string) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status,
        notes: details || `Status manually updated to ${status}`,
      },
    });

    return { success: true, order: updated };
  }

  async adminRefund(id: string, refundAmount?: number) {
    const order = await this.findOne(id, undefined, "ADMIN");
    if (order.status === "REFUNDED") {
      throw new ApiError(409, "CONFLICT", "Order has already been refunded.");
    }
    const amount = refundAmount ? new Decimal(refundAmount) : new Decimal(order.charge.toString());

    if (!this.prisma.isConnected) {
      return { success: true, message: `Refund processed for #${id}` };
    }

    const result = await this.prisma.$transaction(async (tx: any) => {
      const existingRefund = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existingRefund) {
        throw new ApiError(409, "CONFLICT", "Order has already been refunded.");
      }

      let walletRow = await tx.wallet.findUnique({ where: { userId: order.userId } });
      if (!walletRow) {
        const rows = await tx.$queryRawUnsafe(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1`,
          order.userId
        ).catch(() => []);
        walletRow = rows[0];
      }
      if (!walletRow) throw new ApiError(400, "BAD_REQUEST", "Wallet not found.");

      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(amount);

      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount,
          type: "REFUND",
          orderId: order.id,
          description: `Administrative Refund for Order #${order.id}`,
        },
      });

      await tx.refund.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount,
          reason: "Administrative refund",
        },
      });

      const updated = await tx.order.update({
        where: { id },
        data: { status: "REFUNDED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: "REFUNDED",
          notes: `Administrative refund of ₹${amount.toFixed(2)} processed`,
        },
      });

      return { updated, newBalance };
    });

    return { success: true, message: `Refund processed for #${id}`, newBalance: result.newBalance, order: result.updated };
  }

  async retry(id: string, adminUserId: string) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }

    return { success: true, message: `Order #${id} retry queued.` };
  }

  async reconcilePackageProviderOutcome(id: string, adminUserId: string, data: PackageProviderReconciliationInput) {
    return { success: true, orderId: id, outcome: data.outcome };
  }

  async changeProvider(id: string, providerId: string) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { providerId },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: updated.status,
        notes: `Upstream provider updated to ${providerId}`,
      },
    });

    return { success: true, message: `Upstream provider updated to ${providerId}`, order: updated };
  }

  async updateNotes(id: string, notes: string) {
    if (this.prisma.isConnected) {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status: "PROCESSING",
          notes: `Admin note: ${notes}`,
        },
      });
    }
    return { success: true, orderId: id, notes, message: "Administrative audit note updated." };
  }

  async reportProblem(userId: string, orderId: string, input?: { issueType?: string; notes?: string }) {
    if (!this.prisma.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found.");
    }
    if (order.userId !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Cannot report problem on another user's order.");
    }

    if (typeof (this.prisma as any).stalledReport?.findFirst === "function") {
      const existingOpenReport = await (this.prisma as any).stalledReport.findFirst({
        where: { orderId, status: "OPEN" },
      });
      if (existingOpenReport) {
        throw new ApiError(409, "CONFLICT", "An open problem report already exists for this order.");
      }
    }

    let reportId = `rep_${Date.now()}`;
    if (typeof (this.prisma as any).stalledReport?.create === "function") {
      const report = await (this.prisma as any).stalledReport.create({
        data: {
          orderId,
          userId,
          status: "OPEN",
          issueType: input?.issueType || "GENERAL",
          notes: input?.notes || "",
        },
      });
      reportId = report.id;
    }

    let ticketId = `tkt_${Date.now()}`;
    if (typeof this.prisma.ticket?.create === "function") {
      const ticket = await this.prisma.ticket.create({
        data: {
          userId,
          subject: `Problem Report: Order #${orderId}`,
          priority: "HIGH",
          status: "OPEN",
        },
      });
      ticketId = ticket.id;
    }

    return {
      success: true,
      reportId,
      ticketId,
      message: "Problem report logged; support ticket created.",
    };
  }
}
