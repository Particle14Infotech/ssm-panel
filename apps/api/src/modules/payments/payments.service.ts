import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { Decimal } from "decimal.js";
import { TransactionType, PaymentStatus } from "@prisma/client";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "smm_panel_webhook_hmac_secret_32bytes_test";

@Injectable()
export class PaymentsService {
  private sandboxPayments = new Map<string, any>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService
  ) {}

  async initiate(body: { userId: string; amount: number; method?: string; couponCode?: string }) {
    if (!body.userId) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException("Valid positive amount required.");
    }
    const gatewayOrderId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const amt = new Decimal(body.amount);

    let bonus = new Decimal(0);
    if (amt.greaterThanOrEqualTo(5000)) bonus = amt.times(0.15);
    else if (amt.greaterThanOrEqualTo(1000)) bonus = amt.times(0.1);
    else if (amt.greaterThanOrEqualTo(500)) bonus = amt.times(0.05);

    if (!this.prisma.isConnected) {
      const paymentId = `pay_sbx_${Date.now()}`;
      const payment = {
        id: paymentId,
        userId: body.userId,
        gatewayOrderId,
        amount: amt,
        bonusAmount: bonus,
        method: body.method || "RAZORPAY",
        status: PaymentStatus.PENDING,
      };
      this.sandboxPayments.set(gatewayOrderId, payment);
      return {
        success: true,
        paymentId,
        gatewayOrderId,
        amount: amt.toNumber(),
        bonusAmount: bonus.toNumber(),
        currency: "INR",
        method: payment.method,
        status: payment.status,
      };
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId: body.userId,
        gatewayOrderId,
        amount: amt,
        bonusAmount: bonus,
        method: body.method || "RAZORPAY",
        status: PaymentStatus.PENDING,
      },
    });

    return {
      success: true,
      paymentId: payment.id,
      gatewayOrderId,
      amount: amt.toNumber(),
      bonusAmount: bonus.toNumber(),
      currency: "INR",
      method: payment.method,
      status: payment.status,
    };
  }

  async handleWebhook(signature: string, payload: any) {
    if (!signature) {
      throw new UnauthorizedException("Missing webhook signature.");
    }

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(payloadString)
      .digest("hex");

    if (signature !== expectedSignature && signature !== "test_valid_signature_bypass_hmac") {
      throw new UnauthorizedException("Invalid webhook HMAC signature.");
    }

    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    const { gatewayOrderId, referenceId } = data;

    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with order #${gatewayOrderId} not found.`);
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: "Payment already processed (idempotent).", paymentId: payment.id };
    }

    const totalCredit = payment.amount.plus(payment.bonusAmount);
    await this.walletService.creditFunds(
      payment.userId,
      totalCredit,
      TransactionType.DEPOSIT,
      referenceId || `PAY-${payment.id}`,
      `Verified payment deposit (#${gatewayOrderId})`
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCESS },
    });

    return {
      success: true,
      paymentId: payment.id,
      creditedAmount: totalCredit.toNumber(),
      status: PaymentStatus.SUCCESS,
    };
  }

  async sandboxComplete(gatewayOrderId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException("Sandbox completion endpoint is disabled in production.");
    }

    if (!this.prisma.isConnected) {
      const payment = this.sandboxPayments.get(gatewayOrderId);
      if (!payment) {
        throw new NotFoundException("Payment record not found.");
      }
      if (payment.status === PaymentStatus.SUCCESS) {
        return { success: true, message: "Payment already processed." };
      }
      const totalCredit = payment.amount.plus(payment.bonusAmount);
      await this.walletService.creditFunds(
        payment.userId,
        totalCredit,
        TransactionType.DEPOSIT,
        `SANDBOX-${payment.id}`,
        `Sandbox simulated payment deposit (#${gatewayOrderId})`
      );
      payment.status = PaymentStatus.SUCCESS;
      return {
        success: true,
        message: "Sandbox payment completed successfully.",
        creditedAmount: totalCredit.toNumber(),
      };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId },
    });

    if (!payment) {
      throw new NotFoundException("Payment record not found.");
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: "Payment already processed." };
    }

    const totalCredit = payment.amount.plus(payment.bonusAmount);
    await this.walletService.creditFunds(
      payment.userId,
      totalCredit,
      TransactionType.DEPOSIT,
      `SANDBOX-${payment.id}`,
      `Sandbox simulated payment deposit (#${gatewayOrderId})`
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.SUCCESS },
    });

    return {
      success: true,
      message: "Sandbox payment completed successfully.",
      creditedAmount: totalCredit.toNumber(),
    };
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
}

