/**
 * Provider Error Classifier
 *
 * Deterministic, table-driven classification of upstream SMM provider error strings
 * into actionable architectural dispositions:
 * - DEFINITE_REJECTION: validation/terminal errors (e.g. quantity out of bounds, invalid link). Fail run, refund, unblock chain.
 * - RETRY_LATER: transient congestion or overlap (e.g. active order on link, rate limit). Reschedule run with deterministic backoff.
 * - AMBIGUOUS: connection dropped or 5xx AFTER request dispatched. Outcome unknown; query provider before resubmitting.
 */

export enum ProviderErrorDisposition {
  DEFINITE_REJECTION = "DEFINITE_REJECTION",
  RETRY_LATER = "RETRY_LATER",
  AMBIGUOUS = "AMBIGUOUS",
}

export interface ErrorClassificationRule {
  id: string;
  pattern: RegExp;
  disposition: ProviderErrorDisposition;
  description: string;
  retryDelaySeconds?: number;
}

export interface ProviderErrorClassification {
  disposition: ProviderErrorDisposition;
  ruleId: string;
  normalizedMessage: string;
  retryDelaySeconds?: number;
  shouldRefund: boolean;
  canContinueChain: boolean;
}

export const PROVIDER_ERROR_RULES: ErrorClassificationRule[] = [
  // 1. Definite Rejections (Parameter validation & terminal provider rejections)
  {
    id: "QTY_BELOW_MIN",
    pattern: /quantity\s+(?:less\s+than\s+minimal|below\s+min|too\s+low)/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Ordered quantity is strictly below provider minimum threshold",
  },
  {
    id: "QTY_ABOVE_MAX",
    pattern: /quantity\s+(?:more\s+than\s+max|exceeds\s+max|too\s+high)/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Ordered quantity exceeds provider maximum threshold",
  },
  {
    id: "INVALID_LINK_OR_URL",
    pattern: /(?:invalid|incorrect|malformed|bad)\s+(?:link|url|target|username|format)/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Target link format rejected by provider validation",
  },
  {
    id: "SERVICE_INACTIVE_OR_DISABLED",
    pattern: /service\s+(?:is\s+)?(?:disabled|inactive|not\s+found|unavailable|paused|deprecated)/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Requested provider service ID is currently inactive or unsupported",
  },
  {
    id: "INSUFFICIENT_PROVIDER_BALANCE",
    pattern: /(?:not\s+enough\s+balance|low\s+balance|insufficient\s+funds)/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Upstream provider reseller account balance depleted",
  },
  {
    id: "UNSUPPORTED_STATE",
    pattern: /unsupported\s+state\s+or\s+unable\s+to\s+authenticate/i,
    disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
    description: "Authentication or protocol state invalid for requested endpoint",
  },

  // 2. Retry Later (Transient collisions or rate constraints)
  {
    id: "ACTIVE_ORDER_LINK_OVERLAP",
    pattern: /(?:active\s+order\s+with\s+this\s+link|already\s+have\s+active\s+order|order\s+already\s+in\s+progress)/i,
    disposition: ProviderErrorDisposition.RETRY_LATER,
    description: "Provider anti-collision lock active for target link",
    retryDelaySeconds: 900, // 15 minutes deterministic spacing
  },
  {
    id: "RATE_LIMIT_EXCEEDED",
    pattern: /(?:too\s+many\s+requests|rate\s+limit|rate-limited|429)/i,
    disposition: ProviderErrorDisposition.RETRY_LATER,
    description: "Provider API quota limit exceeded",
    retryDelaySeconds: 300, // 5 minutes deterministic backoff
  },
  {
    id: "PROVIDER_TEMPORARILY_BUSY",
    pattern: /(?:provider\s+busy|service\s+(?:is\s+)?busy|temporarily\s+overloaded|try\s+again\s+later)/i,
    disposition: ProviderErrorDisposition.RETRY_LATER,
    description: "Provider queue saturated",
    retryDelaySeconds: 600, // 10 minutes deterministic backoff
  },
  {
    id: "PRE_FLIGHT_NETWORK_ERROR",
    pattern: /(?:ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN)/i,
    disposition: ProviderErrorDisposition.RETRY_LATER,
    description: "Network connectivity dropped prior to server dispatch",
    retryDelaySeconds: 180, // 3 minutes backoff
  },

  // 3. Ambiguous Post-Flight Errors (Outcome unknown)
  {
    id: "TIMEOUT_AFTER_DISPATCH",
    pattern: /(?:ETIMEDOUT|ESOCKETTIMEDOUT|timeout\s+of\s+\d+ms\s+exceeded|timed\s*out)/i,
    disposition: ProviderErrorDisposition.AMBIGUOUS,
    description: "Upstream timeout occurred after socket establishment",
  },
  {
    id: "HTTP_5XX_SERVER_ERROR",
    pattern: /(?:HTTP\s*50[0234]|Internal\s+Server\s+Error|Bad\s+Gateway|Gateway\s+Timeout)/i,
    disposition: ProviderErrorDisposition.AMBIGUOUS,
    description: "Provider 5xx error after order request was received",
  },
];

/**
 * Classifies an error message into a structured disposition.
 */
export function classifyProviderError(
  rawError: string | Error | unknown,
  context?: { stage?: "BEFORE_SEND" | "AFTER_SEND" }
): ProviderErrorClassification {
  const message =
    typeof rawError === "string"
      ? rawError
      : rawError instanceof Error
      ? rawError.message
      : String(rawError || "Unknown error");

  const normalized = message.trim();

  // Evaluate table-driven rules in order
  for (const rule of PROVIDER_ERROR_RULES) {
    if (rule.pattern.test(normalized)) {
      const isDefinite = rule.disposition === ProviderErrorDisposition.DEFINITE_REJECTION;
      const isRetry = rule.disposition === ProviderErrorDisposition.RETRY_LATER;

      return {
        disposition: rule.disposition,
        ruleId: rule.id,
        normalizedMessage: normalized,
        retryDelaySeconds: rule.retryDelaySeconds,
        shouldRefund: isDefinite,
        canContinueChain: isDefinite, // Definite rejection finishes run so next run can proceed
      };
    }
  }

  // Fallback heuristic:
  // If stage was explicitly AFTER_SEND, unresolved error is treated as AMBIGUOUS to prevent double-charging.
  if (context?.stage === "AFTER_SEND") {
    return {
      disposition: ProviderErrorDisposition.AMBIGUOUS,
      ruleId: "AMBIGUOUS_FALLBACK",
      normalizedMessage: normalized,
      shouldRefund: false,
      canContinueChain: false,
    };
  }

  // Default fallback is treated as DEFINITE_REJECTION if it contains "error:" or client 4xx, else AMBIGUOUS
  if (/(?:error:|HTTP\s*400|invalid|rejected)/i.test(normalized)) {
    return {
      disposition: ProviderErrorDisposition.DEFINITE_REJECTION,
      ruleId: "GENERIC_REJECTION",
      normalizedMessage: normalized,
      shouldRefund: true,
      canContinueChain: true,
    };
  }

  return {
    disposition: ProviderErrorDisposition.AMBIGUOUS,
    ruleId: "GENERIC_AMBIGUOUS",
    normalizedMessage: normalized,
    shouldRefund: false,
    canContinueChain: false,
  };
}

