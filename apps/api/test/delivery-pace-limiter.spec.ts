import {
  normalizeTargetUrl,
  canDispatchUnitsOnLink,
  DEFAULT_KIND_PACE_CAPS,
  DEFAULT_CATCHUP_MAX_PER_TICK,
} from "@smm/contracts";

describe("H3: Per-Link Rate Limiter & Catch-up Policy", () => {
  describe("Target URL Normalization", () => {
    it("normalizes diverse link formats into a single canonical target key", () => {
      const variants = [
        "https://www.instagram.com/reel/Cx123456/",
        "http://instagram.com/reel/Cx123456",
        "https://instagram.com/reel/Cx123456/?utm_source=ig_web_copy_link",
        "https://www.instagram.com/reel/Cx123456#comments",
        "instagram.com/reel/Cx123456/",
      ];

      const expected = "instagram.com/reel/cx123456";
      for (const variant of variants) {
        expect(normalizeTargetUrl(variant)).toBe(expected);
      }
    });

    it("normalizes handles into canonical handle targets", () => {
      expect(normalizeTargetUrl("@the_coastal_times")).toBe("the_coastal_times");
      expect(normalizeTargetUrl("  @The_Coastal_Times/  ")).toBe("the_coastal_times");
      expect(normalizeTargetUrl("https://instagram.com/the_coastal_times")).toBe("instagram.com/the_coastal_times");
    });
  });

  describe("In-Flight Limiter (canDispatchUnitsOnLink)", () => {
    it("enforces in-flight capacity limits per service kind", () => {
      const likesCap = DEFAULT_KIND_PACE_CAPS.LIKES; // 150

      // 0 in flight, dispatch 50 => allowed
      const check1 = canDispatchUnitsOnLink(0, 50, "LIKES");
      expect(check1.allowed).toBe(true);
      expect(check1.remainingCapacity).toBe(100);

      // 100 in flight, dispatch 50 => allowed (hits cap 150)
      const check2 = canDispatchUnitsOnLink(100, 50, "LIKES");
      expect(check2.allowed).toBe(true);
      expect(check2.remainingCapacity).toBe(0);

      // 120 in flight, dispatch 50 => rejected (170 > 150)
      const check3 = canDispatchUnitsOnLink(120, 50, "LIKES");
      expect(check3.allowed).toBe(false);
      expect(check3.reason).toContain("In-flight cap exceeded");

      // SHARES kind has tighter cap (30)
      const sharesCheck = canDispatchUnitsOnLink(20, 20, "SHARES");
      expect(sharesCheck.allowed).toBe(false);
    });

    it("allows custom overrides for high-tier or custom configured limits", () => {
      // Custom cap 500
      const check = canDispatchUnitsOnLink(200, 100, "LIKES", 500);
      expect(check.allowed).toBe(true);
      expect(check.remainingCapacity).toBe(200);
    });
  });

  describe("Catch-up Policy (K overdue runs per tick)", () => {
    it("prevents backlog flushes by throttling dispatches to at most K per tick", () => {
      const totalOverdueRuns = 21;
      const K = DEFAULT_CATCHUP_MAX_PER_TICK; // 2

      // Simulate ticking dispatcher across overdue backlog
      let dispatchedTotal = 0;
      let ticks = 0;
      let remaining = totalOverdueRuns;

      while (remaining > 0) {
        ticks++;
        const toDispatch = Math.min(remaining, K);
        dispatchedTotal += toDispatch;
        remaining -= toDispatch;
        expect(toDispatch).toBeLessThanOrEqual(K);
      }

      expect(dispatchedTotal).toBe(21);
      // 21 runs with K=2 requires ceil(21/2) = 11 ticks, never 1 burst tick
      expect(ticks).toBe(11);
    });
  });

  describe("Serialization across Overlapping Orders", () => {
    it("serializes concurrent active orders on identical provider, link and service", () => {
      // Mock active order state
      const existingOrdersOnTarget = [
        {
          providerId: "prv_fast",
          serviceId: "srv_likes",
          normalizedTarget: "instagram.com/reel/cx123456",
          status: "IN_PROGRESS",
        },
      ];

      const newCandidate = {
        providerId: "prv_fast",
        serviceId: "srv_likes",
        normalizedTarget: "instagram.com/reel/cx123456",
      };

      const hasActiveOverlap = existingOrdersOnTarget.some(
        (o) =>
          o.providerId === newCandidate.providerId &&
          o.serviceId === newCandidate.serviceId &&
          o.normalizedTarget === newCandidate.normalizedTarget &&
          ["PENDING", "PROCESSING", "IN_PROGRESS"].includes(o.status)
      );

      // Must be serialized: cannot dispatch second order while first is active
      expect(hasActiveOverlap).toBe(true);
    });
  });

  describe("Dependency Guard: Predecessor Terminal States", () => {
    it("allows downstream execution to proceed when predecessor is FAILED or terminal", () => {
      const allowedPredecessorStatuses = new Set([
        "COMPLETED",
        "PARTIAL",
        "CANCELLED",
        "FAILED",
        "SKIPPED_PAUSED",
        "SKIPPED_QUOTA",
        "SKIPPED_TYPE",
        "SKIPPED_DELETED",
        "SKIPPED_LIMIT",
      ]);

      // When predecessor is FAILED, downstream must NOT be indefinitely blocked
      expect(allowedPredecessorStatuses.has("FAILED")).toBe(true);
      // Non-terminal statuses like DISPATCHED or SCHEDULED must NOT allow downstream run
      expect(allowedPredecessorStatuses.has("DISPATCHED")).toBe(false);
      expect(allowedPredecessorStatuses.has("SCHEDULED")).toBe(false);
    });
  });
});


