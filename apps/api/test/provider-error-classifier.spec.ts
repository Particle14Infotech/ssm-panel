import {
  classifyProviderError,
  ProviderErrorDisposition,
} from "@smm/contracts";

describe("ProviderErrorClassifier (H1 Regression Suite)", () => {
  it("classifies quantity below min as DEFINITE_REJECTION and enables chain continuation", () => {
    const error1 = "Upstream provider error: Quantity less than minimal 10";
    const res1 = classifyProviderError(error1);
    expect(res1.disposition).toBe(ProviderErrorDisposition.DEFINITE_REJECTION);
    expect(res1.shouldRefund).toBe(true);
    expect(res1.canContinueChain).toBe(true);

    const error2 = "Upstream provider error: Quantity less than minimal 100";
    const res2 = classifyProviderError(error2);
    expect(res2.disposition).toBe(ProviderErrorDisposition.DEFINITE_REJECTION);
  });

  it("classifies quantity above max as DEFINITE_REJECTION", () => {
    const error = "Upstream provider error: Quantity exceeds maximum 50000";
    const res = classifyProviderError(error);
    expect(res.disposition).toBe(ProviderErrorDisposition.DEFINITE_REJECTION);
    expect(res.shouldRefund).toBe(true);
  });

  it("classifies invalid link or disabled service as DEFINITE_REJECTION", () => {
    const errorLink = "Upstream provider error: Invalid link provided";
    expect(classifyProviderError(errorLink).disposition).toBe(
      ProviderErrorDisposition.DEFINITE_REJECTION
    );

    const errorService = "Upstream provider error: Service is disabled";
    expect(classifyProviderError(errorService).disposition).toBe(
      ProviderErrorDisposition.DEFINITE_REJECTION
    );
  });

  it("classifies active order link overlap as RETRY_LATER with deterministic spacing", () => {
    const error =
      "Upstream provider error: You have active order with this link. Please wait until order being completed.";
    const res = classifyProviderError(error);
    expect(res.disposition).toBe(ProviderErrorDisposition.RETRY_LATER);
    expect(res.retryDelaySeconds).toBe(900);
    expect(res.shouldRefund).toBe(false);
    expect(res.canContinueChain).toBe(false);
  });

  it("classifies rate limit and busy provider as RETRY_LATER", () => {
    const errorRate = "Provider error: Too many requests (rate limit)";
    const resRate = classifyProviderError(errorRate);
    expect(resRate.disposition).toBe(ProviderErrorDisposition.RETRY_LATER);
    expect(resRate.retryDelaySeconds).toBe(300);

    const errorBusy = "Service is busy, try again later";
    const resBusy = classifyProviderError(errorBusy);
    expect(resBusy.disposition).toBe(ProviderErrorDisposition.RETRY_LATER);
  });

  it("classifies socket timeout and 5xx after send as AMBIGUOUS to prevent double-charging", () => {
    const errorTimeout = "Error: ETIMEDOUT connect upstream";
    const resTimeout = classifyProviderError(errorTimeout, { stage: "AFTER_SEND" });
    expect(resTimeout.disposition).toBe(ProviderErrorDisposition.AMBIGUOUS);
    expect(resTimeout.shouldRefund).toBe(false);
    expect(resTimeout.canContinueChain).toBe(false);

    const error502 = "Upstream SMM API returned HTTP 502 Bad Gateway";
    const res502 = classifyProviderError(error502, { stage: "AFTER_SEND" });
    expect(res502.disposition).toBe(ProviderErrorDisposition.AMBIGUOUS);
  });
});

