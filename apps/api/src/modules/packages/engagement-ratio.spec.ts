/**
 * TDD Unit Tests for Engagement Ratio Guardrail (Roadmap §5.3)
 *
 * Tests the pure logic of classifyServiceMetric() and checkEngagementRatio()
 * exported from @smm/contracts.
 *
 * Test-Driven Development: tests written FIRST, then the implementation satisfies them.
 */
import { classifyServiceMetric, checkEngagementRatio } from "@smm/contracts";

describe("Engagement Ratio Guardrail", () => {
  describe("classifyServiceMetric", () => {
    it("classifies view-type services", () => {
      expect(classifyServiceMetric("Instagram Views")).toBe("views");
      expect(classifyServiceMetric("YouTube Watch Hours")).toBe("views");
      expect(classifyServiceMetric("Reel Impressions")).toBe("views");
      expect(classifyServiceMetric("Post Reach")).toBe("views");
    });

    it("classifies like-type services", () => {
      expect(classifyServiceMetric("Instagram Likes")).toBe("likes");
      expect(classifyServiceMetric("YouTube Hearts")).toBe("likes");
      expect(classifyServiceMetric("Facebook Reactions")).toBe("likes");
    });

    it("classifies comment-type services", () => {
      expect(classifyServiceMetric("Custom Comments")).toBe("comments");
      expect(classifyServiceMetric("Random Comments")).toBe("comments");
    });

    it("classifies share-type services", () => {
      expect(classifyServiceMetric("TikTok Shares")).toBe("shares");
      expect(classifyServiceMetric("Twitter Reposts")).toBe("shares");
      expect(classifyServiceMetric("Retweets")).toBe("shares");
    });

    it("classifies follower-type services", () => {
      expect(classifyServiceMetric("Instagram Followers")).toBe("followers");
    });

    it("classifies subscriber-type services", () => {
      expect(classifyServiceMetric("YouTube Subscribers")).toBe("subscribers");
    });

    it("returns null for unrecognized service types", () => {
      expect(classifyServiceMetric("")).toBeNull();
      expect(classifyServiceMetric("Profile Visit")).toBeNull();
      expect(classifyServiceMetric("Story Poll Votes")).toBeNull();
    });
  });

  describe("checkEngagementRatio", () => {
    describe("Rule 1: likes vs. views", () => {
      it("returns danger warning when likes > 3× views", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 50000,
          existingMetrics: { views: 2000 },
        });
        expect(warnings.length).toBeGreaterThanOrEqual(1);
        expect(warnings[0].level).toBe("danger");
        expect(warnings[0].triggerMetric).toBe("likes");
        expect(warnings[0].lowMetric).toBe("views");
        expect(warnings[0].suggestedQuantity).toBeGreaterThan(0);
      });

      it("returns warning when likes > 1.5× views but ≤ 3×", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 4000,
          existingMetrics: { views: 2000 },
        });
        expect(warnings.length).toBe(1);
        expect(warnings[0].level).toBe("warning");
      });

      it("returns empty array when likes ≤ 1.5× views (healthy ratio)", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 2000,
          existingMetrics: { views: 5000 },
        });
        expect(warnings).toEqual([]);
      });

      it("returns empty when no existing view data", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 50000,
          existingMetrics: {},
        });
        expect(warnings).toEqual([]);
      });

      it("returns empty when views are 0 (avoid division by zero)", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 50000,
          existingMetrics: { views: 0 },
        });
        expect(warnings).toEqual([]);
      });
    });

    describe("Rule 2: comments vs. likes", () => {
      it("warns when comments > likes", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Custom Comments",
          quantity: 200,
          existingMetrics: { likes: 50 },
        });
        expect(warnings.length).toBe(1);
        expect(warnings[0].level).toBe("warning");
        expect(warnings[0].triggerMetric).toBe("comments");
        expect(warnings[0].lowMetric).toBe("likes");
        expect(warnings[0].suggestedQuantity).toBe(1000); // 200 × 5
      });

      it("no warning when comments ≤ likes", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Custom Comments",
          quantity: 20,
          existingMetrics: { likes: 500 },
        });
        expect(warnings).toEqual([]);
      });
    });

    describe("Rule 3: shares vs. views", () => {
      it("warns when shares > views", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "TikTok Shares",
          quantity: 5000,
          existingMetrics: { views: 1000 },
        });
        expect(warnings.length).toBe(1);
        expect(warnings[0].level).toBe("danger");
        expect(warnings[0].triggerMetric).toBe("shares");
        expect(warnings[0].lowMetric).toBe("views");
      });

      it("no warning when shares ≤ views", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "TikTok Shares",
          quantity: 100,
          existingMetrics: { views: 5000 },
        });
        expect(warnings).toEqual([]);
      });
    });

    describe("Edge cases", () => {
      it("returns empty when no existingMetrics provided", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Instagram Likes",
          quantity: 50000,
        });
        expect(warnings).toEqual([]);
      });

      it("returns empty for unrecognized service types", () => {
        const warnings = checkEngagementRatio({
          serviceCategory: "Profile Visits",
          quantity: 50000,
          existingMetrics: { views: 100 },
        });
        expect(warnings).toEqual([]);
      });
    });
  });
});
