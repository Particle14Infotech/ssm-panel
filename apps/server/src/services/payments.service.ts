import { PrismaLike } from "../prisma";
import { WalletService } from "./wallet.service";
import { ApiError } from "../errors";
import { Decimal } from "decimal.js";
import { TransactionType, PaymentStatus } from "@prisma/client";
import { SimulatedPaymentProvider } from "./simulated-payment.provider";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";
import { PaymentProvider } from "./payment-provider.interface";

export class PaymentsService {
  private sandboxPayments = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaLike,
    private readonly walletService: WalletService,
    private readonly simulatedProvider: SimulatedPaymentProvider = new SimulatedPaymentProvider(),
    private readonly razorpayProvider: RazorpayPaymentProvider = new RazorpayPaymentProvider()
  ) {}

  private getProvider(): PaymentProvider {
    const configured = process.env.PAYMENT_PROVIDER?.toLowerCase();
    if (configured === "razorpay") {
      return this.razorpayProvider;
    }
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(403, "FORBIDDEN", "Simulated payment processing is disabled in production.");
    }
    if (!configured || configured === "simulated") {
      return this.simulatedProvider;
    }
    throw new ApiError(403, "FORBIDDEN", `Unsupported payment provider: ${configured}.`);
  }

  async createPaymentOrder(body: {
    userId: string;
    amount: number;
    idempotencyKey?: string;
  }) {
    if (!body.userId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required.");
    }
    if (!body.amount || body.amount <= 0 || isNaN(body.amount)) {
      throw new ApiError(400, "BAD_REQUEST", "A valid positive amount is required.");
    }

    const amountRupees = Number(body.amount);
    const amountPaise = Math.round(amountRupees * 100);

    let bonusPaise = 0;
    if (amountRupees >= 5000) bonusPaise = Math.round(amountPaise * 0.15);
    else if (amountRupees >= 1000) bonusPaise = Math.round(amountPaise * 0.10);
    else if (amountRupees >= 500) bonusPaise = Math.round(amountPaise * 0.05);

    const provider = this.getProvider();
    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const providerResult = await provider.createOrder({
      userId: body.userId,
      amountPaise,
      currency: "INR",
      receipt,
      idempotencyKey: body.idempotencyKey,
    });

    const amtDecimal = new Decimal(amountRupees);
    const bonusDecimal = new Decimal(bonusPaise / 100);
    const client = this.prisma.client || this.prisma;

    if (!this.prisma.isConnected || !client.payment?.create) {
      const payment = {
        id: `pay_sbx_${Date.now()}`,
        userId: body.userId,
        gatewayOrderId: providerResult.orderId,
        amount: amtDecimal,
        bonusAmount: bonusDecimal,
        method: "UPI",
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };
      this.sandboxPayments.set(providerResult.orderId, payment);
      return {
        success: true,
        orderId: providerResult.orderId,
        gatewayOrderId: providerResult.orderId,
        amountPaise,
        amountRupees,
        amount: amountRupees,
        bonusRupees: bonusDecimal.toNumber(),
        bonusAmount: bonusDecimal.toNumber(),
        currency: "INR",
        provider: provider.providerName,
        isTestMode: provider.providerName === "simulated",
        keyId: providerResult.keyId || "rzp_test_simulated_key",
      };
    }

    await client.payment.create({
      data: {
        userId: body.userId,
        gatewayOrderId: providerResult.orderId,
        amount: amtDecimal,
        bonusAmount: bonusDecimal,
        method: "UPI",
        status: PaymentStatus.PENDING,
      },
    });

    return {
      success: true,
      orderId: providerResult.orderId,
      gatewayOrderId: providerResult.orderId,
      amountPaise,
      amountRupees,
      amount: amountRupees,
      bonusRupees: bonusDecimal.toNumber(),
      bonusAmount: bonusDecimal.toNumber(),
      currency: "INR",
      provider: provider.providerName,
      isTestMode: provider.providerName === "simulated",
      keyId: providerResult.keyId || "rzp_test_simulated_key",
    };
  }

  async verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature?: string;
    userId: string;
    method?: string;
    testOutcome?: "success" | "failure";
  }) {
    if (!input.orderId || !input.paymentId) {
      throw new ApiError(400, "BAD_REQUEST", "orderId and paymentId are required for verification.");
    }
    if (!input.userId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required.");
    }

    const provider = this.getProvider();
    const verification = await provider.verifyPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      userId: input.userId,
      method: input.method,
      testOutcome: input.testOutcome,
    });

    const client = this.prisma.client || this.prisma;
    if (!verification.success) {
      if (this.prisma.isConnected && client.payment?.updateMany) {
        await client.payment.updateMany({
          where: { gatewayOrderId: input.orderId, userId: input.userId },
          data: { status: PaymentStatus.FAILED },
        });
      }
      throw new ApiError(400, "BAD_REQUEST", verification.error || "Payment verification failed.");
    }

    let payment: any = null;
    if (!this.prisma.isConnected || !client.payment?.findUnique) {
      payment = this.sandboxPayments.get(input.orderId);
      if (!payment) {
        payment = {
          id: `pay_sbx_${Date.now()}`,
          userId: input.userId,
          gatewayOrderId: input.orderId,
          amount: new Decimal(500),
          bonusAmount: new Decimal(25),
          status: PaymentStatus.PENDING,
        };
        this.sandboxPayments.set(input.orderId, payment);
      }
    } else {
      payment = await client.payment.findUnique({
        where: { gatewayOrderId: input.orderId },
      });
    }

    if (!payment) {
      throw new ApiError(404, "NOT_FOUND", `Payment order ${input.orderId} not found.`);
    }

    if (payment.userId !== input.userId) {
      throw new ApiError(403, "FORBIDDEN", "Payment order does not belong to the authenticated user.");
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return {
        success: true,
        message: "Payment already verified and credited (idempotent).",
        paymentId: input.paymentId,
        credited: false,
        amount: Number(payment.amount),
      };
    }

    const totalCredit = new Decimal(payment.amount.toString()).plus(new Decimal(payment.bonusAmount.toString()));

    if (!this.prisma.isConnected || !client.wallet?.findUnique) {
      payment.status = PaymentStatus.SUCCESS;
      payment.method = input.method || "UPI";
      const creditRes = await this.walletService.creditFunds(
        input.userId,
        totalCredit,
        TransactionType.DEPOSIT,
        input.paymentId,
        `Deposit via ${input.method || "UPI"} (${input.paymentId})`
      );

      return {
        success: true,
        paymentId: input.paymentId,
        creditedAmount: totalCredit.toNumber(),
        status: "paid",
        newBalance: Number(creditRes.newBalance),
      };
    }

    const txHandler = async (tx: any) => {
      let walletRow: any = null;
      if (typeof tx.$queryRawUnsafe === "function") {
        try {
          const rows = await tx.$queryRawUnsafe(
            `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
            input.userId
          );
          walletRow = Array.isArray(rows) ? rows[0] : null;
        } catch {}
      }
      if (!walletRow && tx.wallet?.findUnique) {
        walletRow = await tx.wallet.findUnique({ where: { userId: input.userId } });
      }

      if (!walletRow) {
        throw new ApiError(400, "BAD_REQUEST", "Wallet not found for authenticated user.");
      }

      if (tx.ledgerEntry?.findFirst) {
        const existingEntry = await tx.ledgerEntry.findFirst({
          where: { referenceId: input.paymentId },
        });
        if (existingEntry) {
          return {
            alreadyCredited: true,
            balance: Number(walletRow.balance),
          };
        }
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(totalCredit);

      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      if (tx.ledgerEntry?.create) {
        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: totalCredit,
            type: TransactionType.DEPOSIT,
            referenceId: input.paymentId,
            idempotencyKey: input.orderId,
            description: `Deposit via ${input.method || "UPI"} (${input.paymentId})`,
          },
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          method: input.method || "UPI",
        },
      });

      return {
        alreadyCredited: false,
        balance: newBalance.toNumber(),
      };
    };

    const result = typeof this.prisma.$transaction === "function"
      ? await this.prisma.$transaction(txHandler)
      : await txHandler(client);

    return {
      success: true,
      paymentId: input.paymentId,
      creditedAmount: totalCredit.toNumber(),
      status: "paid",
      newBalance: result.balance,
    };
  }

  async handleWebhook(signature: string, payload: any) {
    if (!signature) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing webhook signature header.");
    }

    const provider = this.getProvider();
    const webhookRes = await provider.handleWebhook(payload, signature);

    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    const paymentEntity = data?.payload?.payment?.entity || data;
    const gatewayOrderId = paymentEntity?.order_id || data?.gatewayOrderId;
    const paymentId = paymentEntity?.id || data?.paymentId;

    const client = this.prisma.client || this.prisma;
    if (gatewayOrderId && paymentId && this.prisma.isConnected && client.payment?.findUnique) {
      const payment = await client.payment.findUnique({
        where: { gatewayOrderId },
      });

      if (payment && payment.status !== PaymentStatus.SUCCESS) {
        await this.verifyPayment({
          orderId: gatewayOrderId,
          paymentId,
          signature,
          userId: payment.userId,
          method: paymentEntity?.method || "WEBHOOK",
        });
      }
    }

    return { success: true, processed: true, webhookRes };
  }

  async findAll(userId?: string, requesterRole?: string) {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.payment?.findMany) {
      const all = Array.from(this.sandboxPayments.values());
      if (requesterRole === "ADMIN") {
        return userId ? all.filter((p) => p.userId === userId) : all;
      }
      return userId ? all.filter((p) => p.userId === userId) : [];
    }
    const where = requesterRole === "ADMIN" ? (userId ? { userId } : {}) : (userId ? { userId } : { userId: "none" });
    return client.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async initiate(body: { userId: string; amount: number; method?: string; couponCode?: string }) {
    return this.createPaymentOrder(body);
  }

  async sandboxComplete(gatewayOrderId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(404, "NOT_FOUND", "Sandbox completion is disabled in production.");
    }

    const client = this.prisma.client || this.prisma;
    const payment = this.prisma.isConnected && client.payment?.findUnique
      ? await client.payment.findUnique({ where: { gatewayOrderId } })
      : this.sandboxPayments.get(gatewayOrderId);

    if (!payment) {
      throw new ApiError(404, "NOT_FOUND", "Payment record not found.");
    }

    return this.verifyPayment({
      orderId: gatewayOrderId,
      paymentId: `pay_sim_${Date.now()}`,
      userId: payment.userId,
      method: "SIMULATED",
      testOutcome: "success",
    });
  }
}
