export interface PaymentOrderParams {
  userId: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  idempotencyKey?: string;
  notes?: Record<string, string>;
}

export interface PaymentOrderResult {
  orderId: string; // e.g. order_XXXXXXXX
  amountPaise: number;
  currency: string;
  status: "created" | "attempted" | "paid" | "failed" | "expired";
  keyId?: string;
}

export interface PaymentVerificationParams {
  orderId: string;
  paymentId: string; // e.g. pay_XXXXXXXX
  signature?: string;
  userId: string;
  amountPaise?: number;
  method?: string;
  testOutcome?: "success" | "failure";
}

export interface PaymentVerificationResult {
  success: boolean;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  status: "paid" | "failed";
  error?: string;
}

export interface PaymentRefundParams {
  paymentId: string;
  amountPaise?: number;
  reason?: string;
}

export interface PaymentProvider {
  readonly providerName: "simulated" | "razorpay";
  createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(params: PaymentVerificationParams): Promise<PaymentVerificationResult>;
  handleWebhook(payload: any, signature: string): Promise<any>;
  refund(params: PaymentRefundParams): Promise<any>;
}
