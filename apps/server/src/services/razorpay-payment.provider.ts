import crypto from "crypto";
import {
  PaymentProvider,
  PaymentOrderParams,
  PaymentOrderResult,
  PaymentVerificationParams,
  PaymentVerificationResult,
  PaymentRefundParams,
} from "./payment-provider.interface";
import { ApiError } from "../errors";

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly providerName = "razorpay" as const;
  private customKeyId?: string;
  private customKeySecret?: string;
  private customWebhookSecret?: string;

  setCredentials(keyId?: string, keySecret?: string, webhookSecret?: string) {
    this.customKeyId = keyId;
    this.customKeySecret = keySecret;
    this.customWebhookSecret = webhookSecret;
  }

  private getKeyId(): string {
    return typeof this.customKeyId === "string" ? this.customKeyId : (process.env.RAZORPAY_KEY_ID || "");
  }

  private getKeySecret(): string {
    return typeof this.customKeySecret === "string" ? this.customKeySecret : (process.env.RAZORPAY_KEY_SECRET || "");
  }

  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();

    if (!keyId || !keySecret) {
      throw new ApiError(
        501,
        "NOT_IMPLEMENTED",
        "Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured. Switch to simulated mode via PAYMENT_PROVIDER=simulated."
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    try {
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amountPaise,
          currency: params.currency || "INR",
          receipt: params.receipt,
          notes: {
            userId: params.userId,
            ...(params.notes || {}),
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errorDesc = (data as any)?.error?.description || "Razorpay order creation failed";
        throw new ApiError(res.status === 400 ? 400 : 502, "BAD_GATEWAY", `Razorpay API error: ${errorDesc}`);
      }

      return {
        orderId: data.id,
        amountPaise: data.amount,
        currency: data.currency,
        status: data.status,
        keyId,
      };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, "BAD_GATEWAY", `Razorpay connection error: ${err.message}`);
    }
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    if (params.isWebhookVerified || params.method === "WEBHOOK") {
      return {
        success: true,
        orderId: params.orderId,
        paymentId: params.paymentId,
        amountPaise: params.amountPaise || 0,
        status: "paid",
      };
    }

    const keySecret = this.getKeySecret();
    if (!keySecret) {
      throw new ApiError(501, "NOT_IMPLEMENTED", "RAZORPAY_KEY_SECRET is not configured.");
    }

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

  async handleWebhook(payload: any, signature: string, rawBody?: Buffer | string, webhookSecretOverride?: string): Promise<any> {
    const webhookSecret = webhookSecretOverride || this.customWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || this.getKeySecret();
    if (!webhookSecret) {
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "RAZORPAY_WEBHOOK_SECRET is not configured.");
    }

    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === "string" ? rawBody : (typeof payload === "string" ? payload : JSON.stringify(payload)), "utf8");

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("hex");

    const expBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature || "", "utf8");
    const isValid = expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);

    if (!isValid) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid Razorpay webhook signature.");
    }

    return {
      success: true,
      received: true,
      event: payload?.event,
    };
  }

  async refund(_params: PaymentRefundParams): Promise<any> {
    throw new ApiError(501, "NOT_IMPLEMENTED", "Razorpay refund is awaiting production credentials.");
  }
}
