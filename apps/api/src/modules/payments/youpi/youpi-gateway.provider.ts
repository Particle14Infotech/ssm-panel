import { Injectable, BadRequestException } from "@nestjs/common";
import {
  PaymentProvider,
  PaymentOrderParams,
  PaymentOrderResult,
  PaymentVerificationParams,
  PaymentVerificationResult,
  PaymentRefundParams
} from "../payment-provider.interface";
import { YoupiService } from "./youpi.service";
import { PrismaService } from "../../../common/prisma.service";
import { YoupiTopUpStatus } from "@prisma/client";

@Injectable()
export class YoupiGatewayProvider implements PaymentProvider {
  readonly providerName = "youpi" as const;

  constructor(
    private readonly youpiService: YoupiService,
    private readonly prisma: PrismaService
  ) {}

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const amountRupees = params.amountPaise / 100;
    const res = await this.youpiService.createTopUp(params.userId, amountRupees);
    return {
      orderId: res.orderRef,
      amountPaise: res.amountPaise,
      currency: res.currency,
      status: "created",
      keyId: res.checkoutUrl
    };
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const topUp = await this.prisma.youpiTopUp.findUnique({
      where: { orderRef: params.orderId }
    });

    if (!topUp) {
      return {
        success: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        amountPaise: params.amountPaise || 0,
        status: "failed",
        error: "Top-up order reference not found."
      };
    }

    if (topUp.status === YoupiTopUpStatus.CREDITED) {
      return {
        success: true,
        orderId: topUp.orderRef,
        paymentId: topUp.gatewaySessionId || topUp.id,
        amountPaise: topUp.amountPaise,
        status: "paid"
      };
    }

    return {
      success: false,
      orderId: topUp.orderRef,
      paymentId: topUp.gatewaySessionId || topUp.id,
      amountPaise: topUp.amountPaise,
      status: "failed",
      error: `Top-up payment is currently in status: ${topUp.status}. Wallet credit requires bank reconciliation or admin confirmation.`
    };
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    throw new BadRequestException(
      "YouPI webhooks must be delivered to the dedicated /api/v1/payments/youpi/webhook endpoint with raw byte signatures."
    );
  }

  async refund(params: PaymentRefundParams): Promise<any> {
    throw new BadRequestException(
      "Automated refunds are not supported for UPI pilot top-ups. Refunds require manual operator bank reversal."
    );
  }
}

