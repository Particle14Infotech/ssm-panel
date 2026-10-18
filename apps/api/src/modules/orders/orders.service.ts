import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { SettingsService } from "../settings/settings.service";
import { PricingService } from "../pricing/pricing.service";
import { OrderStatus, OutboxStatus } from "@prisma/client";
import {
  calculateOrderFinancialSnapshot,
  calculateCustomerCharge,
  DEFAULT_PRICING_SETTINGS,
} from "@smm/contracts";
import { Decimal } from "decimal.js";

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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private sandboxOrders = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly settingsService?: SettingsService,
    private readonly pricingService?: PricingService
  ) {}

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
    return safeOrder;
  }

  async findAll(userId?: string, requesterRole?: string, filters?: OrderFilterDto) {
    if (!this.prisma.isConnected) {
      const orders = Array.from(this.sandboxOrders.values());
      if (userId) return orders.filter((o) => o.userId === userId);
      return requesterRole === "ADMIN" ? orders : [];
    }

    try {
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
      };

      if (requesterRole === "ADMIN") {
        include.provider = { select: { id: true, name: true } };
        include.user = { select: { id: true, email: true, name: true } };
        include.providerEvents = { orderBy: { createdAt: "asc" } };
      }

      const orders = await this.prisma.order.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });
      return orders.map((order) => this.sanitizeOrderForRole(order, requesterRole));
    } catch (err: any) {
      this.logger.error(`Error querying orders: ${err.message}`);
      return [];
    }
  }

  async findOne(id: string, requesterUserId?: string, requesterRole?: string) {
    if (!this.prisma.isConnected) {
      const sandboxOrder = this.sandboxOrders.get(id);
      if (sandboxOrder) {
        if (requesterRole !== "ADMIN" && requesterUserId && sandboxOrder.userId !== requesterUserId) {
          throw new NotFoundException(`Order #${id} not found.`);
        }
        return this.sanitizeOrderForRole(sandboxOrder, requesterRole);
      }
      throw new NotFoundException(`Order #${id} not found.`);
    }

    const include: any = {
      service: true,
      history: {
        orderBy: { createdAt: "asc" },
      },
      refunds: true,
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
      throw new NotFoundException(`Order #${id} not found.`);
    }

    if (requesterRole !== "ADMIN" && requesterUserId && order.userId !== requesterUserId) {
      throw new NotFoundException(`Order #${id} not found.`);
    }

    return this.sanitizeOrderForRole(order, requesterRole);
  }

  /**
   * Dispatches a new order with atomic balance deduction and idempotency check.
   */
  async create(input: CreateOrderDto) {
    // 1. Strict Input Validation
    if (!input.serviceId || typeof input.serviceId !== "string" || !input.target || !input.quantity) {
      throw new BadRequestException("serviceId, target URL, and quantity are required.");
    }
    if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
      throw new BadRequestException("Quantity must be a positive integer.");
    }

    const userId = input.userId;
    if (!userId) {
      throw new BadRequestException("Authenticated user ID is required to dispatch orders.");
    }

    // 2. Fetch service safely
    let service: any = null;
    if (this.prisma.isConnected) {
      try {
        service = await this.prisma.service.findUnique({
          where: { id: input.serviceId },
        });
      } catch {
        // DB offline fallback
      }
    }

    if (!service) {
      throw new BadRequestException("Invalid service ID provided.");
    }

    if (service.status !== "ACTIVE" || service.isDeleted || service.active === false) {
      throw new BadRequestException("Service is currently unavailable.");
    }

    if (service.priceBelowCost) {
      throw new BadRequestException("This service is temporarily unavailable due to pricing adjustment.");
    }

    // Quote = Charge validation: if client submitted expectedRate, ensure DB rate matches
    if (input.expectedRate !== undefined && input.expectedRate !== null) {
      const currentRate = new Decimal(service.ratePer1000.toString()).toNumber();
      const expected = new Decimal(input.expectedRate).toNumber();
      if (Math.abs(currentRate - expected) > 0.001) {
        throw new ConflictException("Price updated, please confirm the new price before placing the order.");
      }
    }

    // Handle Custom Comments service type
    const isCustomComments = service.serviceType === "CUSTOM_COMMENTS" || service.serviceType === "COMMENTS";
    if (isCustomComments) {
      if (input.isDripFeed) {
        throw new BadRequestException("Drip-feed is not supported for custom comments.");
      }
      if (!input.comments || !input.comments.trim()) {
        throw new BadRequestException("Comments are required for this service (one comment per line).");
      }
      const commentLines = input.comments
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (commentLines.length === 0) {
        throw new BadRequestException("At least one comment line is required.");
      }
      if (commentLines.length !== input.quantity) {
        throw new BadRequestException(
          `Number of comment lines (${commentLines.length}) must match the requested quantity (${input.quantity}).`
        );
      }
    }

    if (input.quantity < service.minQty || input.quantity > service.maxQty) {
      throw new BadRequestException(
        `Quantity must be between ${service.minQty} and ${service.maxQty}.`
      );
    }

    // 3. Drip-feed validation & parameter resolution
    const isDripFeed = Boolean(input.isDripFeed);
    const settings = this.settingsService?.getSettings() || {
      dripFeedEnabled: true,
      dripFeedMinRuns: 2,
      dripFeedMaxRuns: 100,
      dripFeedMinInterval: 5,
      dripFeedMaxInterval: 1440,
    };

    let runs = 1;
    let intervalMinutes: number | null = null;
    let totalQuantity = input.quantity;

    if (isDripFeed) {
      if (settings.dripFeedEnabled === false) {
        throw new BadRequestException("Drip-feed ordering is currently disabled.");
      }
      if (!service.dripFeedSupported) {
        throw new BadRequestException("This service does not support drip-feed fulfillment.");
      }
      if (!input.runs || typeof input.runs !== "number" || !Number.isInteger(input.runs)) {
        throw new BadRequestException("Runs parameter is required and must be an integer for drip-feed orders.");
      }
      if (!input.interval || typeof input.interval !== "number" || !Number.isInteger(input.interval)) {
        throw new BadRequestException("Interval parameter (minutes) is required and must be an integer for drip-feed orders.");
      }

      const minRuns = service.dripFeedMinRuns ?? settings.dripFeedMinRuns ?? 2;
      const maxRuns = service.dripFeedMaxRuns ?? settings.dripFeedMaxRuns ?? 100;
      if (input.runs < minRuns || input.runs > maxRuns) {
        throw new BadRequestException(`Runs must be between ${minRuns} and ${maxRuns}.`);
      }

      const minInterval = service.dripFeedMinInterval ?? settings.dripFeedMinInterval ?? 5;
      const maxInterval = service.dripFeedMaxInterval ?? settings.dripFeedMaxInterval ?? 1440;
      if (input.interval < minInterval || input.interval > maxInterval) {
        throw new BadRequestException(`Interval must be between ${minInterval} and ${maxInterval} minutes.`);
      }

      runs = input.runs;
      intervalMinutes = input.interval;
      totalQuantity = input.quantity * runs;
    } else {
      if (input.runs !== undefined && input.runs !== null) {
        throw new BadRequestException("Runs cannot be specified for non-drip-feed orders.");
      }
      if (input.interval !== undefined && input.interval !== null) {
        throw new BadRequestException("Interval cannot be specified for non-drip-feed orders.");
      }
    }

    // 4. Compute financial snapshot & customer charge
    const pricingSettings = this.pricingService
      ? await this.pricingService.getSettings()
      : DEFAULT_PRICING_SETTINGS;

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

    // Check minimum order charge guardrail
    if (charge.lessThan(pricingSettings.minOrderCharge)) {
      throw new BadRequestException(`Order total charge cannot be less than ₹${pricingSettings.minOrderCharge}.`);
    }

    // 5. Idempotency Key & Fingerprint Check
    if (input.idempotencyKey && this.prisma.isConnected) {
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
          throw new ConflictException("Idempotency key already used with different order parameters.");
        }
        return this.sanitizeOrderForRole(existingOrder, input.requesterRole);
      }
    }

    // 6. Atomic Execution: Debit wallet + Insert Order + Record History + Write Ledger + Enqueue Outbox
    if (!this.prisma.isConnected) {
      const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
      await this.walletService.debitForOrder(
        userId,
        orderId,
        charge,
        input.idempotencyKey,
        `Order Charge #${orderId} for ${service.displayName || service.name}${isDripFeed ? ` (Drip-feed: ${runs}x${input.quantity})` : ""}`
      );
      const order = {
        id: orderId,
        userId,
        serviceId: service.id,
        target: input.target,
        quantity: input.quantity,
        isDripFeed,
        runs: isDripFeed ? runs : null,
        intervalMinutes: isDripFeed ? intervalMinutes : null,
        quantityPerRun: input.quantity,
        totalQuantity,
        charge: typeof charge === "object" && "toNumber" in charge ? (charge as any).toNumber() : Number(charge),
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
        status: OrderStatus.PENDING,
        startCount: 0,
        remains: totalQuantity,
        idempotencyKey: input.idempotencyKey || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        service,
        history: [
          {
            id: `hist_${Date.now()}`,
            orderId,
            status: OrderStatus.PENDING,
            startCount: 0,
            remains: totalQuantity,
            notes: isDripFeed
              ? `Drip-feed order placed: ${runs} runs of ${input.quantity} every ${intervalMinutes}m (${totalQuantity} total). Queued for provider dispatch.`
              : "Order placed and queued for provider dispatch",
            createdAt: new Date(),
          },
        ],
      };
      this.sandboxOrders.set(orderId, order);
      return this.sanitizeOrderForRole(order, input.requesterRole);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 6a. Create order in PENDING status
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: service.id,
          target: input.target,
          quantity: input.quantity,
          isDripFeed,
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
          status: OrderStatus.PENDING,
          providerId: service.providerId || null,
          startCount: 0,
          remains: totalQuantity,
          idempotencyKey: input.idempotencyKey || null,
        },
        include: { service: true },
      });

      // 6b. Record initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          startCount: 0,
          remains: totalQuantity,
          notes: isDripFeed
            ? `Drip-feed order placed: ${runs} runs of ${input.quantity} every ${intervalMinutes}m (${totalQuantity} total). Queued for provider dispatch.`
            : "Order placed and queued for provider dispatch",
        },
      });

      // 6c. Debit wallet with row-level lock
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );
      if (!walletRow) {
        throw new BadRequestException("Wallet not found for user.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      if (currentBalance.lessThan(charge)) {
        throw new BadRequestException("Insufficient wallet balance.");
      }

      const newBalance = currentBalance.minus(charge);
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 6d. Write immutable ledger record
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: charge.negated(),
          type: "ORDER_CHARGE",
          orderId: order.id,
          idempotencyKey: input.idempotencyKey,
          description: `Order Charge #${order.id} for ${service.displayName || service.name}${isDripFeed ? ` (Drip-feed: ${runs}x${input.quantity})` : ""}`,
        },
      });

      // 6e. Enqueue Outbox event
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
            runs: isDripFeed ? runs : null,
            intervalMinutes: isDripFeed ? intervalMinutes : null,
            quantityPerRun: input.quantity,
            totalQuantity,
            providerId: service.providerId,
            providerServiceId: service.providerServiceId,
            comments: input.comments || null,
          },
          status: OutboxStatus.PENDING,
        },
      });

      return order;
    });

    return this.sanitizeOrderForRole(result, input.requesterRole);
  }

  async refill(id: string, requesterUserId?: string, requesterRole?: string) {
    const order = await this.findOne(id, requesterUserId, requesterRole);
    if (!order.service?.refillable) {
      throw new BadRequestException("This service does not support refills.");
    }

    if (this.prisma.isConnected) {
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
          status: OutboxStatus.PENDING,
        },
      });
    }

    return { success: true, message: `Refill request submitted for order #${id}`, orderId: id };
  }

  async cancel(id: string, requesterUserId?: string, requesterRole?: string) {
    const order = await this.findOne(id, requesterUserId, requesterRole);
    if (!order.service?.cancellable && requesterRole !== "ADMIN") {
      throw new BadRequestException("This service cannot be cancelled.");
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new ConflictException("Order is already cancelled or refunded.");
    }
    if (order.status === OrderStatus.COMPLETED && requesterRole !== "ADMIN") {
      throw new ConflictException("Completed orders cannot be cancelled.");
    }

    if (!this.prisma.isConnected) {
      order.status = OrderStatus.CANCELLED;
      return { success: true, message: `Order #${id} cancelled and refunded.`, order };
    }

    const refundCharge = new Decimal(order.charge.toString());

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock wallet
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        order.userId
      );
      if (!walletRow) {
        throw new BadRequestException("Wallet not found for refund.");
      }

      // Check if refund ledger entry already exists
      const existingRefund = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existingRefund) {
        throw new ConflictException("Order refund already processed.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(refundCharge);

      // Credit wallet
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // Write ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: refundCharge,
          type: "REFUND",
          orderId: order.id,
          description: `Full Refund for Cancelled Order #${order.id}`,
        },
      });

      // Write Refund table row
      await tx.refund.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: refundCharge,
          reason: "Order cancellation",
        },
      });

      // Update Order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });

      // Record OrderStatusHistory
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: OrderStatus.CANCELLED,
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

  async updateStatus(id: string, status: OrderStatus, details?: string) {
    if (!this.prisma.isConnected) return { success: true };

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
    const order = await this.findOne(id);
    const amount = refundAmount ? new Decimal(refundAmount) : new Decimal(order.charge.toString());

    if (!this.prisma.isConnected) {
      return { success: true, message: `Refund processed for #${id}` };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        order.userId
      );
      if (!walletRow) throw new BadRequestException("Wallet not found.");

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
        data: { status: OrderStatus.REFUNDED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: OrderStatus.REFUNDED,
          notes: `Administrative refund of ₹${amount.toFixed(2)} processed`,
        },
      });

      return { updated, newBalance };
    });

    return { success: true, message: `Refund processed for #${id}`, newBalance: result.newBalance, order: result.updated };
  }

  async retry(id: string) {
    if (!this.prisma.isConnected) return { success: true };

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.PROCESSING },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: OrderStatus.PROCESSING,
        notes: "Order dispatch retry queued",
      },
    });

    await this.prisma.outboxEvent.create({
      data: {
        aggregate: "ORDER",
        eventType: "ORDER_CREATED",
        payload: { orderId: id },
        status: OutboxStatus.PENDING,
      },
    });

    return { success: true, message: `Order #${id} queued for retry dispatch.`, order: updated };
  }

  async changeProvider(id: string, providerId: string) {
    if (!this.prisma.isConnected) return { success: true };

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
          status: OrderStatus.PROCESSING,
          notes: `Admin note: ${notes}`,
        },
      });
    }
    return { success: true, orderId: id, notes, message: "Administrative audit note updated." };
  }
}
