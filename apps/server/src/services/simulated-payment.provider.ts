import {
  PaymentProvider,
  PaymentOrderParams,
  PaymentOrderResult,
  PaymentVerificationParams,
  PaymentVerificationResult,
  PaymentRefundParams,
} from "./payment-provider.interface";
import { ApiError } from "../errors";

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly providerName = "simulated" as const;

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const randomHex = Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderId = `order_${randomHex}`;

    return {
      orderId,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      status: "created",
      keyId: "rzp_test_simulated_key",
    };
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const isExplicitFailure =
      params.testOutcome === "failure" ||
      (params.signature && params.signature.includes("failure")) ||
      (params.paymentId && params.paymentId.includes("failure"));

    if (isExplicitFailure) {
      return {
        success: false,
        orderId: params.orderId,
        paymentId: params.paymentId || `pay_fail_${Date.now()}`,
        amountPaise: params.amountPaise || 0,
        status: "failed",
        error: "Simulated payment failed: Card declined / Test failure trigger.",
      };
    }

    const paymentId = params.paymentId && !params.paymentId.includes("mock")
      ? params.paymentId
      : `pay_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    return {
      success: true,
      orderId: params.orderId,
      paymentId,
      amountPaise: params.amountPaise || 0,
      status: "paid",
    };
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    if (!signature || signature.includes("forged") || signature.includes("invalid") || signature.includes("unverified")) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid simulated webhook signature.");
    }
    return {
      success: true,
      received: true,
      event: payload?.event || "payment.captured",
      processedAt: new Date().toISOString(),
    };
  }

  async refund(params: PaymentRefundParams): Promise<any> {
    const refundId = `rfnd_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    return {
      refundId,
      paymentId: params.paymentId,
      amountPaise: params.amountPaise,
      status: "processed",
      createdAt: new Date().toISOString(),
    };
  }
}
