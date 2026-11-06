export interface YoupiPilotSettings {
  enabled: boolean;
  killSwitch: boolean;
  allowlistUserIds: string[];
  receivingUpiIds: string[];
  minAmountPaise: number;
  maxAmountPaise: number;
  maxDailyAttemptsPerAccount: number;
  maxDailyCreditPaisePerAccount: number;
  maxUserDailyAttempts: number;
  maxUserDailyAmountPaise: number;
  secondApprovalThresholdPaise: number;
  sessionExpirySeconds: number;
  webhookReplayWindowSeconds: number;
  pilotAcknowledgement?: {
    adminName: string;
    confirmedAt: string;
    statement: string;
  };
}

export interface YoupiCreateOrderResponse {
  paymentId: string;
  orderId: string;
  amount: string;
  amountPaise: string;
  currency: string;
  status: string;
  checkoutUrl: string;
}

export interface YoupiWebhookPayload {
  event: string;
  deliveryId: string;
  timestamp: number;
  paymentId: string;
  orderId: string;
  attemptId?: string;
  amount: string;
  amountPaise: number;
  currency: string;
  method?: string;
  utr?: string;
  verificationTag?: string;
  verificationLevel?: number;
  completedAt?: string;
  settlementState?: string;
  metadata?: Record<string, any>;
}

export function maskUtr(utr?: string | null): string {
  if (!utr) return "N/A";
  const trimmed = utr.trim();
  if (trimmed.length <= 4) return "****";
  return `****${trimmed.slice(-4)}`;
}

export function normalizeUtr(utr?: string | null): string {
  if (!utr) return "";
  return utr.trim().toUpperCase();
}

