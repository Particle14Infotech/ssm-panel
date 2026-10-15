import { Injectable, Logger, NotImplementedException } from "@nestjs/common";
import crypto from "crypto";
import {
  PaymentProvider,
  PaymentOrderParams,
  PaymentOrderResult,
  PaymentVerificationParams,
  PaymentVerificationResult,
  PaymentRefundParams,
} from "./payment-provider.interface";

@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly providerName = "razorpay" as const;
  private readonly logger = new Logger(RazorpayPaymentProvider.name);
  private customKeyId?: string;
  private customKeySecret?: string;
  private customWebhookSecret?: string;

  setCredentials(keyId?: string, keySecret?: string, webhookSecret?: string) {
    this.customKeyId = keyId;
    this.customKeySecret = keySecret;
    this.customWebhookSecret = webhookSecret;
  }

  private getKeyId(): string {
    return this.customKeyId || process.env.RAZORPAY_KEY_ID || "";
  }

  private getKeySecret(): string {
    return this.customKeySecret || process.env.RAZORPAY_KEY_SECRET || "";
  }

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();

    if (!keyId || !keySecret) {
      throw new NotImplementedException(
        "Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured. Switch to simulated mode via PAYMENT_PROVIDER=simulated."
      );
    }

    // TODO: When live credentials are provided, invoke Razorpay API:
    // const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    // const res = await fetch("https://api.razorpay.com/v1/orders", {
    //   method: "POST",
    //   headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ amount: params.amountPaise, currency: params.currency, receipt: params.receipt })
    // });
    // return res.json();

    throw new NotImplementedException("Razorpay live order creation is awaiting production credentials.");
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const keySecret = this.getKeySecret();
    if (!keySecret) {
      throw new NotImplementedException("RAZORPAY_KEY_SECRET is not configured.");
    }

    // Razorpay standard signature verification:
    // HMAC-SHA256 of `order_id + "|" + razorpay_payment_id` using `key_secret`
    if (!params.signature) {
      return {
        success: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        amountPaise: params.amountPaise || 0,
        status: "failed",
        error: "Missing Razorpay payment signature.",
      };
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest("hex");

    const expBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(params.signature, "utf8");
    const isValid = expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);

    if (!isValid) {
      return {
        success: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        amountPaise: params.amountPaise || 0,
        status: "failed",
        error: "Invalid Razorpay payment signature.",
      };
    }

    return {
      success: true,
      orderId: params.orderId,
      paymentId: params.paymentId,
      amountPaise: params.amountPaise || 0,
      status: "paid",
    };
  }

  async handleWebhook(payload: any, signature: string, webhookSecretOverride?: string): Promise<any> {
    const webhookSecret = webhookSecretOverride || this.customWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || this.getKeySecret();
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadString)
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new Error("Invalid Razorpay webhook signature.");
    }

    // TODO: Parse event `payment.captured` or `refund.processed`
    return {
      success: true,
      received: true,
      event: payload?.event,
    };
  }

  async refund(params: PaymentRefundParams): Promise<any> {
    // TODO: Invoke https://api.razorpay.com/v1/payments/{paymentId}/refund
    throw new NotImplementedException("Razorpay refund is awaiting production credentials.");
  }
}
