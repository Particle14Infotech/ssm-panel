import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { calculateOrderCharge } from "../../common/money.util";
import { OrderStatus, OutboxStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

export interface CreateOrderDto {
  userId?: string;
  serviceId: string;
  target: string;
  quantity: number;
  idempotencyKey?: string;
}

export interface OrderFilterDto {
  status?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private sandboxOrders = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService
  ) {}

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

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }

      return await this.prisma.order.findMany({
        where,
        include: {
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
          provider: requesterRole === "ADMIN" ? { select: { id: true, name: true } } : false,
        },
        orderBy: { createdAt: "desc" },
      });
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
        return sandboxOrder;
      }
      throw new NotFoundException(`Order #${id} not found.`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        service: true,
        history: {
          orderBy: { createdAt: "asc" },
        },
        refunds: true,
        provider: requesterRole === "ADMIN" ? { select: { id: true, name: true } } : false,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found.`);
    }

    if (requesterRole !== "ADMIN" && requesterUserId && order.userId !== requesterUserId) {
      throw new NotFoundException(`Order #${id} not found.`);
    }

    return order;
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

    if (input.quantity < service.minQty || input.quantity > service.maxQty) {
      throw new BadRequestException(
        `Quantity must be between ${service.minQty} and ${service.maxQty}.`
      );
    }

    // 3. Compute accurate financial charge
    const charge = calculateOrderCharge(input.quantity, service.ratePer1000);

    // 4. Atomic Execution: Debit wallet + Insert Order + Record History + Write Ledger + Enqueue Outbox
    if (!this.prisma.isConnected) {
      const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
      await this.walletService.debitForOrder(
        userId,
        orderId,
        charge,
        input.idempotencyKey,
        `Order Charge #${orderId} for ${service.name}`
      );
      const order = {
        id: orderId,
        userId,
        serviceId: service.id,
        target: input.target,
        quantity: input.quantity,
        charge: typeof charge === "object" && "toNumber" in charge ? (charge as any).toNumber() : Number(charge),
        status: OrderStatus.PENDING,
        startCount: 0,
        remains: input.quantity,
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
            remains: input.quantity,
            notes: "Order placed and queued for provider dispatch",
            createdAt: new Date(),
          },
        ],
      };
      this.sandboxOrders.set(orderId, order);
      return order;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 4a. Create order in PENDING status
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: service.id,
          target: input.target,
          quantity: input.quantity,
          charge,
          status: OrderStatus.PENDING,
          providerId: service.providerId || null,
          startCount: 0,
          remains: input.quantity,
          idempotencyKey: input.idempotencyKey || null,
        },
        include: { service: true },
      });

      // 4b. Record initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          startCount: 0,
          remains: input.quantity,
          notes: "Order placed and queued for provider dispatch",
        },
      });

      // 4c. Debit wallet with row-level lock
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

      // 4d. Write immutable ledger record
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: charge.negated(),
          type: "ORDER_CHARGE",
          orderId: order.id,
          idempotencyKey: input.idempotencyKey,
          description: `Order Charge #${order.id} for ${service.name}`,
        },
      });

      // 4e. Enqueue Outbox event
      await tx.outboxEvent.create({
        data: {
          aggregate: "ORDER",
          eventType: "ORDER_CREATED",
          payload: {
            orderId: order.id,
            serviceId: service.id,
            target: order.target,
            quantity: order.quantity,
            providerId: service.providerId,
            providerServiceId: service.providerServiceId,
          },
          status: OutboxStatus.PENDING,
        },
      });

      return order;
    });

    return result;
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
