import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { Decimal } from "decimal.js";
import { TransactionType, PaymentStatus } from "@prisma/client";
import { SimulatedPaymentProvider } from "./simulated-payment.provider";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";
import { PaymentProvider } from "./payment-provider.interface";
import { EmailService } from "../email/email.service";
import { Optional } from "@nestjs/common";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private sandboxPayments = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly simulatedProvider: SimulatedPaymentProvider = new SimulatedPaymentProvider(),
    private readonly razorpayProvider: RazorpayPaymentProvider = new RazorpayPaymentProvider(),
    @Optional() private readonly emailService?: EmailService
  ) {}

  private getProvider(): PaymentProvider {
    const configured = process.env.PAYMENT_PROVIDER?.toLowerCase();
    if (configured === "razorpay") {
      return this.razorpayProvider;
    }
    return this.simulatedProvider;
  }

  /**
   * Creates a new payment order.
   * Money = integer paise everywhere internally.
   */
  async createPaymentOrder(body: {
    userId: string;
    amount: number; // in Rupees
    idempotencyKey?: string;
  }) {
    if (!body.userId) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    if (!body.amount || body.amount <= 0 || isNaN(body.amount)) {
      throw new BadRequestException("A valid positive amount is required.");
    }

    const amountRupees = Number(body.amount);
    // Convert to integer paise
    const amountPaise = Math.round(amountRupees * 100);

    // Calculate standard promotional bonus
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

    if (!this.prisma.isConnected) {
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

    await this.prisma.payment.create({
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

  /**
   * Only server-side verifyPayment() credits the wallet:
   * One transaction, idempotent, rejects amount/user mismatch.
   */
  async verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature?: string;
    userId: string;
    method?: string;
    testOutcome?: "success" | "failure";
  }) {
    if (!input.orderId || !input.paymentId) {
      throw new BadRequestException("orderId and paymentId are required for verification.");
    }
    if (!input.userId) {
      throw new BadRequestException("Authenticated user ID is required.");
    }

    const provider = this.getProvider();

    // 1. Verify with provider
    const verification = await provider.verifyPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      userId: input.userId,
      method: input.method,
      testOutcome: input.testOutcome,
    });

    if (!verification.success) {
      // Mark failed
      if (this.prisma.isConnected) {
        await this.prisma.payment.updateMany({
          where: { gatewayOrderId: input.orderId, userId: input.userId },
          data: { status: PaymentStatus.FAILED },
        });
      }
      throw new BadRequestException(verification.error || "Payment verification failed.");
    }

    // 2. Fetch recorded payment
    let payment: any = null;
    if (!this.prisma.isConnected) {
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
      payment = await this.prisma.payment.findUnique({
        where: { gatewayOrderId: input.orderId },
      });
    }

    if (!payment) {
      throw new NotFoundException(`Payment order ${input.orderId} not found.`);
    }

    // Strict ownership verification
    if (payment.userId !== input.userId) {
      throw new ForbiddenException("Payment order does not belong to the authenticated user.");
    }

    // Idempotency check: if already SUCCESS, return immediately without re-crediting
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

    // 3. Atomically credit wallet inside ONE database transaction with row lock
    if (!this.prisma.isConnected) {
      payment.status = PaymentStatus.SUCCESS;
      payment.method = input.method || "UPI";
      await this.walletService.creditFunds(
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
        newBalance: totalCredit.toNumber(),
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Row-level lock on user's wallet
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        input.userId
      );
      if (!walletRow) {
        throw new BadRequestException("Wallet not found for authenticated user.");
      }

      // Check if referenceId has already been recorded in the ledger
      const existingEntry = await tx.ledgerEntry.findFirst({
        where: { referenceId: input.paymentId },
      });
      if (existingEntry) {
        return {
          alreadyCredited: true,
          balance: Number(walletRow.balance),
        };
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(totalCredit);

      // Update wallet balance
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // Write immutable ledger entry
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

      // Update payment record
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
    });

    if (!result.alreadyCredited && this.emailService) {
      this.prisma.user.findUnique({ where: { id: input.userId } }).then((user) => {
        if (user) {
          this.emailService!.sendWalletCreditedEmail(
            user,
            `₹${totalCredit.toFixed(2)}`,
            input.paymentId,
            `₹${Number(result.balance).toFixed(2)}`
          ).catch((err) => {
            this.logger.warn(`Failed to dispatch wallet credit email: ${err.message}`);
          });
        }
      }).catch(() => null);
    }

    return {
      success: true,
      paymentId: input.paymentId,
      creditedAmount: totalCredit.toNumber(),
      status: "paid",
      newBalance: result.balance,
    };
  }

  /**
   * Standardized webhook endpoint for Razorpay and simulated events
   */
  async handleWebhook(signature: string, payload: any) {
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature header.");
    }

    const provider = this.getProvider();
    const webhookRes = await provider.handleWebhook(payload, signature);

    // If event is payment.captured or payment.authorized
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    const paymentEntity = data?.payload?.payment?.entity || data;
    const gatewayOrderId = paymentEntity?.order_id || data?.gatewayOrderId;
    const paymentId = paymentEntity?.id || data?.paymentId;

    if (gatewayOrderId && paymentId && this.prisma.isConnected) {
      const payment = await this.prisma.payment.findUnique({
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
    if (!this.prisma.isConnected) {
      const all = Array.from(this.sandboxPayments.values());
      if (requesterRole === "ADMIN") {
        return userId ? all.filter((p) => p.userId === userId) : all;
      }
      return userId ? all.filter((p) => p.userId === userId) : [];
    }
    const where = requesterRole === "ADMIN" ? (userId ? { userId } : {}) : (userId ? { userId } : { userId: "none" });
    return await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // Backward compatibility alias for legacy initiate
  async initiate(body: { userId: string; amount: number; method?: string; couponCode?: string }) {
    return this.createPaymentOrder(body);
  }

  // Backward compatibility alias for sandboxComplete
  async sandboxComplete(gatewayOrderId: string) {
    const payment = this.prisma.isConnected
      ? await this.prisma.payment.findUnique({ where: { gatewayOrderId } })
      : this.sandboxPayments.get(gatewayOrderId);

    if (!payment) {
      throw new NotFoundException("Payment record not found.");
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
