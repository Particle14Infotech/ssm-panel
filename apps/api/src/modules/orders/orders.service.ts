import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { SettingsService } from "../settings/settings.service";
import { PricingService } from "../pricing/pricing.service";
import { SANDBOX_SERVICES } from "../services/services.service";
import {
  OrderStatus,
  OutboxStatus,
  PackageExecutionStatus,
  TransactionType,
} from "@prisma/client";
import {
  calculateOrderFinancialSnapshot,
  calculateCustomerCharge,
  DEFAULT_PRICING_SETTINGS,
  splitChargeShare,
  generateRunSchedule,
  PACKAGE_PROVIDER_STATUS_STALLED_REASON,
} from "@smm/contracts";
import { Decimal } from "decimal.js";
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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
      throw new ServiceUnavailableException("Database is disconnected. Cannot retrieve orders.");
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
        runsList: {
          orderBy: { runIndex: "asc" },
        },
        packageExecution: {
          select: {
            id: true,
            seq: true,
            packageId: true,
            status: true,
            quantity: true,
            remainingQuantity: true,
            allocatedCharge: true,
            executeAt: true,
            package: {
              select: {
                id: true,
                platform: true,
                handle: true,
                status: true,
                rules: {
                  select: {
                    id: true,
                    kind: true,
                    maxPosts: true,
                    usedCount: true,
                    service: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
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
      throw new ServiceUnavailableException("Database is disconnected. Cannot retrieve order.");
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
      packageExecution: {
        select: {
          id: true,
          seq: true,
          packageId: true,
          status: true,
          quantity: true,
          remainingQuantity: true,
          allocatedCharge: true,
          executeAt: true,
          package: {
            select: {
              id: true,
              platform: true,
              handle: true,
              status: true,
              rules: {
                select: {
                  id: true,
                  kind: true,
                  maxPosts: true,
                  usedCount: true,
                  service: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
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
      throw new NotFoundException(`Order #${id} not found.`);
    }

    if (requesterRole !== "ADMIN") {
      if (!requesterUserId || order.userId !== requesterUserId) {
        throw new NotFoundException(`Order #${id} not found.`);
      }
    }

    return this.sanitizeOrderForRole(order, requesterRole);
  }

  /**
   * Dispatches a new order with atomic balance deduction and idempotency check.
   */
  async create(input: CreateOrderDto) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database is disconnected. Cannot create orders.");
    }

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
    } else {
      service = SANDBOX_SERVICES.find((s) => s.id === input.serviceId);
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
    let dripMode: "NONE" | "NATIVE" | "MANAGED" = "NONE";

    if (isDripFeed) {
      if (process.env.DRIPFEED_ENABLED === "false" || settings.dripFeedEnabled === false) {
        throw new BadRequestException("Standalone drip-feed is deprecated and disabled. Please use Packages.");
      }

      if (service.dripFeedSupported) {
        dripMode = "NATIVE";
      } else if (service.allowManagedDrip || (service.allowManagedDrip === undefined && service.serviceType !== "CUSTOM_COMMENTS" && !service.name?.toLowerCase().includes("comment"))) {
        dripMode = "MANAGED";
      } else {
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

      if (dripMode === "MANAGED") {
        const managedEnabled = process.env.DRIPFEED_MANAGED_ENABLED !== "false" && process.env.DRIPFEED_MANAGED_ENABLED !== "0";
        if (!managedEnabled) {
          throw new BadRequestException("Managed drip-feed ordering is temporarily disabled by administrator.");
        }

        const maxManagedRuns = process.env.DRIPFEED_MANAGED_MAX_RUNS ? parseInt(process.env.DRIPFEED_MANAGED_MAX_RUNS, 10) : 30;
        const minManagedInterval = process.env.DRIPFEED_MANAGED_MIN_INTERVAL ? parseInt(process.env.DRIPFEED_MANAGED_MIN_INTERVAL, 10) : 30;
        const maxTotalHours = process.env.DRIPFEED_MANAGED_MAX_TOTAL_HOURS ? parseInt(process.env.DRIPFEED_MANAGED_MAX_TOTAL_HOURS, 10) : 168;

        if (input.runs > maxManagedRuns) {
          throw new BadRequestException(`Managed drip-feed runs cannot exceed ${maxManagedRuns}.`);
        }
        if (input.interval < minManagedInterval) {
          throw new BadRequestException(`Managed drip-feed interval must be at least ${minManagedInterval} minutes.`);
        }
        const totalDurationHours = ((input.runs - 1) * input.interval) / 60;
        if (totalDurationHours > maxTotalHours) {
          throw new BadRequestException(`Total drip-feed duration cannot exceed ${maxTotalHours} hours.`);
        }

        const maxConcurrent = process.env.MAX_CONCURRENT_MANAGED_PER_USER ? parseInt(process.env.MAX_CONCURRENT_MANAGED_PER_USER, 10) : 5;
        if (this.prisma.isConnected) {
          const activeManagedCount = await this.prisma.order.count({
            where: {
              userId,
              dripMode: "MANAGED",
              status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.IN_PROGRESS] },
            },
          });
          if (activeManagedCount >= maxConcurrent) {
            throw new BadRequestException(`Maximum concurrent active managed drip orders reached (${maxConcurrent}). Please wait for existing runs to finish.`);
          }
        }
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

    const result = await this.prisma.$transaction(async (tx) => {
      // 6a. Create order in PENDING status
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: service.id,
          target: input.target,
          quantity: input.quantity,
          isDripFeed,
          dripMode: dripMode as any,
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

      // 6b. If MANAGED drip, create all OrderRun rows upfront with exact split charges
      if (dripMode === "MANAGED") {
        const shares = splitChargeShare(charge, runs);
        const schedule = generateRunSchedule(new Date(), runs, intervalMinutes || 30);
        const runsData = schedule.map((s, idx) => ({
          orderId: order.id,
          runIndex: s.runIndex,
          quantity: input.quantity,
          scheduledAt: s.scheduledAt,
          status: "SCHEDULED" as any,
          chargeShare: new Decimal(shares[idx]),
          attempts: 0,
          delivered: 0,
        }));

        await tx.orderRun.createMany({
          data: runsData,
        });
      }

      // 6c. Record initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          startCount: 0,
          remains: totalQuantity,
          notes: isDripFeed
            ? `Drip-feed order placed (${dripMode}): ${runs} runs of ${input.quantity} every ${intervalMinutes}m (${totalQuantity} total). Queued for dispatch.`
            : "Order placed and queued for provider dispatch",
        },
      });

      // 6d. Debit wallet with row-level lock
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );
      if (!walletRow) {
        throw new BadRequestException("Wallet not found for user.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      if (currentBalance.lessThan(charge)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: "Insufficient wallet balance. Please add funds to your wallet to place this order.",
            addFundsUrl: "/app/wallet",
          },
          HttpStatus.PAYMENT_REQUIRED
        );
      }

      const newBalance = currentBalance.minus(charge);
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 6e. Write immutable ledger record
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

      if (service.id === "srv_mock_fail" || service.providerServiceId === "103") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.FAILED,
            remains: 0,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.FAILED,
            notes: "Provider dispatch timed out (simulated drill). Automatic refund processed.",
          },
        });
        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: currentBalance },
        });
        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: charge,
            type: "REFUND",
            orderId: order.id,
            description: "Automatic refund: provider dispatch failure drill",
          },
        });
        order.status = OrderStatus.FAILED;
      } else {
        // 6f. Enqueue Outbox event
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
            status: OutboxStatus.PENDING,
          },
        });
      }

      return order;
    });

    return this.sanitizeOrderForRole(result, input.requesterRole);
  }

  async refill(id: string, requesterUserId?: string, requesterRole?: string) {
    const order = await this.findOne(id, requesterUserId, requesterRole);
    if (order.dripMode === "MANAGED") {
      throw new BadRequestException("Refill is not supported on managed drip-feed orders.");
    }
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

    // Managed Drip cancellation: cancel remaining SCHEDULED runs and refund their charge shares
    if (order.dripMode === "MANAGED" && this.prisma.isConnected) {
      const result = await this.prisma.$transaction(async (tx) => {
        const scheduledRuns = await tx.orderRun.findMany({
          where: { orderId: order.id, status: "SCHEDULED" },
        });

        if (scheduledRuns.length === 0) {
          throw new ConflictException("No scheduled runs remain to cancel.");
        }

        let refundAmount = new Decimal(0);
        for (const run of scheduledRuns) {
          refundAmount = refundAmount.plus(new Decimal(run.chargeShare.toString()));
        }

        await tx.orderRun.updateMany({
          where: { orderId: order.id, status: "SCHEDULED" },
          data: { status: "CANCELED" },
        });

        const activeCount = await tx.orderRun.count({
          where: { orderId: order.id, status: { in: ["DISPATCHING", "UNCERTAIN", "PROCESSING"] } },
        });
        const completedCount = await tx.orderRun.count({
          where: { orderId: order.id, status: "COMPLETED" },
        });

        const newOrderStatus = activeCount > 0 
          ? OrderStatus.IN_PROGRESS 
          : completedCount > 0 
            ? OrderStatus.PARTIAL 
            : OrderStatus.CANCELLED;

        const [walletRow] = await tx.$queryRawUnsafe<any[]>(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
          order.userId
        );
        if (!walletRow) throw new BadRequestException("Wallet not found.");

        const currentBalance = new Decimal(walletRow.balance.toString());
        const newBalance = currentBalance.plus(refundAmount);

        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: newBalance },
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: refundAmount,
            type: "REFUND",
            orderId: order.id,
            description: `Refund for ${scheduledRuns.length} cancelled scheduled runs on Order #${order.id}`,
          },
        });

        await tx.refund.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            amount: refundAmount,
            reason: `Customer cancelled ${scheduledRuns.length} scheduled drip runs`,
          },
        });

        const updatedOrder = await tx.order.update({
          where: { id },
          data: { status: newOrderStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            status: newOrderStatus,
            remains: order.remains,
            startCount: order.startCount,
            notes: `Customer cancelled ${scheduledRuns.length} scheduled runs. Refunded ₹${refundAmount.toFixed(2)}.`,
          },
        });

        return { updatedOrder, newBalance, refundAmount };
      });

      return {
        success: true,
        message: `Cancelled scheduled runs and refunded ₹${result.refundAmount.toFixed(2)}.`,
        newBalance: result.newBalance,
        order: result.updatedOrder,
      };
    }

    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database is disconnected. Cannot cancel order.");
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
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    if (status === OrderStatus.COMPLETED) {
      const order = await this.prisma.order.findUnique({
        where: { id },
        select: { packageExecutionId: true },
      });
      if (order?.packageExecutionId) {
        throw new ConflictException(
          "Package execution orders must be completed through provider status verification."
        );
      }
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
    if (order.status === OrderStatus.REFUNDED) {
      throw new ConflictException("Order has already been refunded.");
    }
    const amount = refundAmount ? new Decimal(refundAmount) : new Decimal(order.charge.toString());

    if (!this.prisma.isConnected) {
      return { success: true, message: `Refund processed for #${id}` };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existingRefund = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existingRefund) {
        throw new ConflictException("Order has already been refunded.");
      }

      let walletRow = await tx.wallet.findUnique({ where: { userId: order.userId } });
      if (!walletRow) {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1`,
          order.userId
        ).catch(() => []);
        walletRow = rows[0];
      }
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

  async retry(id: string, adminUserId: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        packageExecutionId: true,
        providerOrderId: true,
        packageExecution: {
          select: { id: true, status: true, skipReason: true },
        },
      },
    });
    if (existingOrder?.packageExecutionId && existingOrder.providerOrderId) {
      const packageExecution = existingOrder.packageExecution;
      if (
        existingOrder.status !== OrderStatus.PROCESSING &&
        existingOrder.status !== OrderStatus.IN_PROGRESS
      ) {
        throw new ConflictException(
          "The package provider order is no longer active and cannot resume status polling."
        );
      }
      if (
        !packageExecution ||
        packageExecution.status !== PackageExecutionStatus.DISPATCHED ||
        packageExecution.skipReason !== PACKAGE_PROVIDER_STATUS_STALLED_REASON
      ) {
        throw new ConflictException(
          "The provider already accepted this package order. It cannot be resubmitted; only a stalled status poll can be resumed."
        );
      }

      return this.prisma.$transaction(async (tx) => {
        const resumed = await tx.packageExecution.updateMany({
          where: {
            id: packageExecution.id,
            orderId: id,
            status: PackageExecutionStatus.DISPATCHED,
            skipReason: PACKAGE_PROVIDER_STATUS_STALLED_REASON,
          },
          data: { skipReason: null },
        });
        if (resumed.count !== 1) {
          throw new ConflictException(
            "Package provider status polling is no longer stalled."
          );
        }

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: "PACKAGE_PROVIDER_STATUS_POLLING_RESUMED",
            resource: id,
            payload: {
              packageExecutionId: packageExecution.id,
            },
          },
        });

        return {
          success: true,
          message:
            "Provider status polling resumed. The accepted child order will not be resubmitted.",
        };
      });
    }

    if (
      existingOrder?.packageExecutionId &&
      existingOrder.status === OrderStatus.PROCESSING &&
      !existingOrder.providerOrderId
    ) {
      throw new ConflictException(
        "Package provider outcome is uncertain. Reconcile it with an administrator before retrying."
      );
    }

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

  async reconcilePackageProviderOutcome(
    orderId: string,
    adminUserId: string,
    input: PackageProviderReconciliationInput
  ) {
    if (!this.prisma.isConnected) {
      throw new BadRequestException(
        "Provider reconciliation requires the connected database."
      );
    }

    const parsed = PackageProviderReconciliationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors[0]?.message || "Invalid reconciliation details."
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const [order] = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          status: OrderStatus;
          packageExecutionId: string | null;
          providerId: string | null;
          providerOrderId: string | null;
        }>
      >(
        `SELECT id, status, "packageExecutionId", "providerId", "providerOrderId"
         FROM "Order"
         WHERE id = $1
         FOR UPDATE`,
        orderId
      );

      if (!order) throw new NotFoundException("Order not found.");
      if (!order.packageExecutionId) {
        throw new BadRequestException(
          "Provider reconciliation is only supported for package execution orders."
        );
      }
      if (
        order.status !== OrderStatus.PROCESSING ||
        order.providerOrderId
      ) {
        throw new ConflictException(
          "Order is no longer awaiting uncertain provider reconciliation."
        );
      }

      const { outcome, evidence } = parsed.data;
      const providerId =
        outcome === "UNRESOLVED" ? order.providerId : parsed.data.providerId;
      if (outcome !== "UNRESOLVED") {
        if (!providerId) {
          throw new BadRequestException("A provider is required for reconciliation.");
        }
        const provider = await tx.provider.findUnique({
          where: { id: providerId },
          select: { id: true, active: true },
        });
        if (!provider) throw new NotFoundException("Provider not found.");
        if (outcome === "REJECTED" && !provider.active) {
          throw new BadRequestException(
            "The rejected provider is inactive and cannot receive the approved retry."
          );
        }
      }

      if (outcome === "UNRESOLVED") {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.PROCESSING,
            notes: `Admin review did not resolve the provider outcome. No retry was queued. Evidence: ${evidence}`,
          },
        });
      } else if (outcome === "ACCEPTED") {
        await tx.order.update({
          where: { id: orderId },
          data: {
            providerId,
            providerOrderId: parsed.data.providerOrderId,
            status: OrderStatus.PROCESSING,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.PROCESSING,
            notes: `Admin confirmed provider acceptance and attached reference ${parsed.data.providerOrderId}. Evidence: ${evidence}`,
          },
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: {
            providerId,
            providerOrderId: null,
            status: OrderStatus.PENDING,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.PENDING,
            notes: `Admin confirmed provider rejection; retry is permitted. Evidence: ${evidence}`,
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregate: "ORDER",
            eventType: "ORDER_CREATED",
            payload: { orderId },
            status: OutboxStatus.PENDING,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: `PACKAGE_PROVIDER_OUTCOME_${outcome}`,
          resource: orderId,
          payload: {
            packageExecutionId: order.packageExecutionId,
            previousProviderId: order.providerId,
            providerId,
            providerOrderId:
              outcome === "ACCEPTED" ? parsed.data.providerOrderId : null,
            evidence,
            retryQueued: outcome === "REJECTED",
          },
        },
      });

      return {
        success: true,
        orderId,
        outcome,
        retryQueued: outcome === "REJECTED",
      };
    });
  }

  async changeProvider(id: string, providerId: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
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
          status: OrderStatus.PROCESSING,
          notes: `Admin note: ${notes}`,
        },
      });
    }
    return { success: true, orderId: id, notes, message: "Administrative audit note updated." };
  }

  async reportProblem(userId: string, orderId: string, input?: { issueType?: string; notes?: string }) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    if (order.userId !== userId) {
      throw new ForbiddenException("Cannot report problem on another user's order.");
    }

    if (typeof (this.prisma as any).stalledReport?.findFirst === "function") {
      const existingOpenReport = await (this.prisma as any).stalledReport.findFirst({
        where: { orderId, status: "OPEN" },
      });
      if (existingOpenReport) {
        throw new ConflictException("An open problem report already exists for this order.");
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
