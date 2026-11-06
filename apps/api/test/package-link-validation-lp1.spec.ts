import {
  parseTargetUrl,
  validateServiceLinkCompatibility,
  type ParsedLinkResult,
} from "@smm/contracts";
import * as fc from "fast-check";

describe("LP1: Local Platform Link Parser & Service Compatibility", () => {
  describe("1. WHATWG URL Parsing & Security Invariants", () => {
    it("rejects non-https URLs (http, ftp, javascript, file)", () => {
      expect(parseTargetUrl("http://www.instagram.com/reel/DfPUjcpSqyQ/").isValid).toBe(false);
      expect(parseTargetUrl("http://www.instagram.com/reel/DfPUjcpSqyQ/").error).toMatch(/https/i);

      expect(parseTargetUrl("ftp://youtube.com/watch?v=dQw4w9WgXcQ").isValid).toBe(false);
      expect(parseTargetUrl("javascript:alert(1)").isValid).toBe(false);
      expect(parseTargetUrl("file:///etc/passwd").isValid).toBe(false);
    });

    it("rejects userinfo (credentials in URL)", () => {
      const res = parseTargetUrl("https://user:pass@www.instagram.com/reel/DfPUjcpSqyQ/");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/credentials|userinfo/i);
    });

    it("rejects non-default ports", () => {
      const res = parseTargetUrl("https://www.youtube.com:8080/watch?v=dQw4w9WgXcQ");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/port/i);
    });

    it("rejects links exceeding maximum length of 2048 characters", () => {
      const longUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&param=" + "a".repeat(2050);
      const res = parseTargetUrl(longUrl);
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/maximum length/i);
    });

    it("rejects short links with exact message 'Paste the full link'", () => {
      const shortLinks = [
        "https://vm.tiktok.com/ZM8vXYZ12/",
        "https://vt.tiktok.com/ZS1234567/",
        "https://fb.watch/xyz123/",
        "https://bit.ly/3xyz123",
        "https://tinyurl.com/abc1234",
        "https://t.co/abcXYZ12",
        "https://goo.gl/maps/abc",
        "https://ow.ly/abc12",
        "https://is.gd/abc12",
        "https://buff.ly/abc12",
        "https://rebrand.ly/abc12",
      ];
      for (const link of shortLinks) {
        const res = parseTargetUrl(link);
        expect(res.isValid).toBe(false);
        expect(res.error).toBe("Paste the full link");
        expect(res.isShortLink).toBe(true);
      }
    });

    it("rejects look-alike hosts, subdomains, and IDN homographs", () => {
      const hostileHosts = [
        "https://evil-instagram.com/reel/DfPUjcpSqyQ/",
        "https://instagram.com.evil.com/reel/DfPUjcpSqyQ/",
        "https://notinstagram.com/p/C8XYZ123/",
        "https://evil-youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.attacker.com/watch?v=dQw4w9WgXcQ",
        "https://evil-tiktok.com/@user/video/7106594312292453678",
        "https://tiktok.com.phishing.org/@user/video/7106594312292453678",
        "https://xn--nstagram-ppb.com/reel/DfPUjcpSqyQ/", // IDN homograph
      ];
      for (const url of hostileHosts) {
        const res = parseTargetUrl(url);
        expect(res.isValid).toBe(false);
        expect(res.error).toMatch(/unsupported|invalid|allowlist|host|supported platform/i);
      }
    });
  });

  describe("2. Supported URL Shapes & Canonicalization", () => {
    it("parses YouTube watch URLs", () => {
      const res = parseTargetUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("YOUTUBE");
      expect(res.kind).toBe("VIDEO");
      expect(res.mediaId).toBe("dQw4w9WgXcQ");
      expect(res.canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });

    it("parses YouTube shorts URLs", () => {
      const res = parseTargetUrl("https://youtube.com/shorts/kJQP7kiw5Fk?feature=share");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("YOUTUBE");
      expect(res.kind).toBe("SHORT");
      expect(res.mediaId).toBe("kJQP7kiw5Fk");
      expect(res.canonicalUrl).toBe("https://www.youtube.com/shorts/kJQP7kiw5Fk");
    });

    it("parses youtu.be short domain URLs", () => {
      const res = parseTargetUrl("https://youtu.be/dQw4w9WgXcQ?t=42");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("YOUTUBE");
      expect(res.kind).toBe("VIDEO");
      expect(res.mediaId).toBe("dQw4w9WgXcQ");
      expect(res.canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });

    it("parses YouTube mobile (m.youtube.com) URLs", () => {
      const res = parseTargetUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("YOUTUBE");
      expect(res.kind).toBe("VIDEO");
      expect(res.mediaId).toBe("dQw4w9WgXcQ");
    });

    it("parses YouTube channel / profile URLs", () => {
      const res = parseTargetUrl("https://www.youtube.com/@RickAstleyYT");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("YOUTUBE");
      expect(res.kind).toBe("PROFILE");
      expect(res.authorHandle).toBe("RickAstleyYT");
    });

    it("parses Instagram reel URLs", () => {
      const res = parseTargetUrl("https://www.instagram.com/reel/DfPUjcpSqyQ/?igsh=abc123");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("INSTAGRAM");
      expect(res.kind).toBe("REEL");
      expect(res.mediaId).toBe("DfPUjcpSqyQ");
      expect(res.canonicalUrl).toBe("https://www.instagram.com/reel/DfPUjcpSqyQ/");
    });

    it("parses Instagram post and tv URLs", () => {
      const resPost = parseTargetUrl("https://instagram.com/p/C8XYZ123_abc/");
      expect(resPost.isValid).toBe(true);
      expect(resPost.platform).toBe("INSTAGRAM");
      expect(resPost.kind).toBe("POST");
      expect(resPost.mediaId).toBe("C8XYZ123_abc");
      expect(resPost.canonicalUrl).toBe("https://www.instagram.com/p/C8XYZ123_abc/");

      const resTv = parseTargetUrl("https://instagram.com/tv/B_123xyz/");
      expect(resTv.isValid).toBe(true);
      expect(resTv.kind).toBe("POST");
      expect(resTv.mediaId).toBe("B_123xyz");
    });

    it("parses Instagram stories and highlight URLs (V2 regression recovery)", () => {
      const resStory = parseTargetUrl("https://www.instagram.com/stories/username/123456789012345/");
      expect(resStory.isValid).toBe(true);
      expect(resStory.platform).toBe("INSTAGRAM");
      expect(resStory.kind).toBe("POST");
      expect(resStory.mediaId).toBe("123456789012345");
      expect(resStory.authorHandle).toBe("username");

      const resHighlight = parseTargetUrl("https://instagram.com/stories/highlights/18012345678901234/");
      expect(resHighlight.isValid).toBe(true);
      expect(resHighlight.platform).toBe("INSTAGRAM");
      expect(resHighlight.kind).toBe("POST");
      expect(resHighlight.mediaId).toBe("18012345678901234");
    });

    it("parses Instagram profile URLs and @handles", () => {
      const res1 = parseTargetUrl("https://www.instagram.com/particle14_/");
      expect(res1.isValid).toBe(true);
      expect(res1.platform).toBe("INSTAGRAM");
      expect(res1.kind).toBe("PROFILE");
      expect(res1.authorHandle).toBe("particle14_");

      const resHandle = parseTargetUrl("@particle14_");
      expect(resHandle.isValid).toBe(true);
      expect(resHandle.kind).toBe("PROFILE");
      expect(resHandle.authorHandle).toBe("particle14_");
    });

    it("parses TikTok video URLs", () => {
      const res = parseTargetUrl("https://www.tiktok.com/@tiktok/video/7106594312292453678?is_from_webapp=1");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("TIKTOK");
      expect(res.kind).toBe("VIDEO");
      expect(res.mediaId).toBe("7106594312292453678");
      expect(res.authorHandle).toBe("tiktok");
      expect(res.canonicalUrl).toBe("https://www.tiktok.com/@tiktok/video/7106594312292453678");
    });

    it("parses TikTok profile URLs", () => {
      const res = parseTargetUrl("https://www.tiktok.com/@tiktok");
      expect(res.isValid).toBe(true);
      expect(res.platform).toBe("TIKTOK");
      expect(res.kind).toBe("PROFILE");
      expect(res.authorHandle).toBe("tiktok");
    });
  });

  describe("3. Service-Kind Compatibility Checks", () => {
    it("rejects profile link when service metric needs a post (likes, views, comments)", () => {
      const profileParsed = parseTargetUrl("https://www.instagram.com/particle14_/");
      const checkLikes = validateServiceLinkCompatibility(profileParsed, "INSTAGRAM", "LIKES");
      expect(checkLikes.isCompatible).toBe(false);
      expect(checkLikes.error).toMatch(/needs a post or reel link|not a profile link/i);

      const checkViews = validateServiceLinkCompatibility(profileParsed, "INSTAGRAM", "VIEWS");
      expect(checkViews.isCompatible).toBe(false);
      expect(checkViews.error).toMatch(/needs a post or reel link|not a profile link/i);
    });

    it("rejects post/reel link when service metric needs a profile (followers, subscribers)", () => {
      const reelParsed = parseTargetUrl("https://www.instagram.com/reel/DfPUjcpSqyQ/");
      const checkFollowers = validateServiceLinkCompatibility(reelParsed, "INSTAGRAM", "FOLLOWERS");
      expect(checkFollowers.isCompatible).toBe(false);
      expect(checkFollowers.error).toMatch(/needs a profile link|not a post link/i);

      const videoParsed = parseTargetUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      const checkSubs = validateServiceLinkCompatibility(videoParsed, "YOUTUBE", "SUBSCRIBERS");
      expect(checkSubs.isCompatible).toBe(false);
      expect(checkSubs.error).toMatch(/needs a channel link|not a video link/i);
    });

    it("rejects cross-platform mismatch with helpful message", () => {
      const ytParsed = parseTargetUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      const checkMismatch = validateServiceLinkCompatibility(ytParsed, "INSTAGRAM", "LIKES");
      expect(checkMismatch.isCompatible).toBe(false);
      expect(checkMismatch.error).toMatch(/for YouTube.*selected service is for Instagram/i);
    });
  });

  describe("4. ReDoS Safety & Property-Based Fuzzing", () => {
    it("processes 10,000 hostile strings under 2.5 seconds without catastrophic backtracking", () => {
      const startTime = Date.now();
      let runs = 0;

      fc.assert(
        fc.property(fc.string({ maxLength: 500 }), (hostile) => {
          runs++;
          const res = parseTargetUrl(hostile);
          expect(typeof res.isValid).toBe("boolean");
          expect(typeof res.platform).toBe("string");
        }),
        { numRuns: 10000 }
      );

      const elapsed = Date.now() - startTime;
      expect(runs).toBe(10000);
      expect(elapsed).toBeLessThan(2500); // 10,000 runs within 2.5s -> safe linear execution!
    });
  });
});
