import {
  DEFAULT_PLATFORM_CONFIGS,
  normalizeHandle,
  validateHandle,
  validatePlatformLink,
  SHORT_LINK_HOSTS,
} from "../src/modules/platforms/platform-rules.util";
import { BadRequestException } from "@nestjs/common";

describe("Milestone M2: Platform Config, Link Validation & Short Link Rejection", () => {
  const getPlat = (plat: string) => {
    const found = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === plat);
    if (!found) throw new Error(`Missing config for ${plat}`);
    return found;
  };

  describe("1. Handle Normalization & Validation Across All 6 Platforms", () => {
    it("normalizes handles by trimming and stripping leading @", () => {
      expect(normalizeHandle("@alice_creator")).toBe("alice_creator");
      expect(normalizeHandle("@@@bob.official ")).toBe("bob.official");
      expect(normalizeHandle("  charlie_123  ")).toBe("charlie_123");
    });

    it("validates valid handles for all 6 platforms", () => {
      expect(validateHandle("@instagram_user.1", getPlat("instagram"))).toBe("instagram_user.1");
      expect(validateHandle("@tiktok.creator_99", getPlat("tiktok"))).toBe("tiktok.creator_99");
      expect(validateHandle("@youtube-creator_88", getPlat("youtube"))).toBe("youtube-creator_88");
      expect(validateHandle("facebook.user.123", getPlat("facebook"))).toBe("facebook.user.123");
      expect(validateHandle("@x_handle_99", getPlat("x"))).toBe("x_handle_99");
      expect(validateHandle("@telegram_channel", getPlat("telegram"))).toBe("telegram_channel");
    });

    it("enforces platform-specific handle maximum length", () => {
      // Instagram: max 30
      const longIg = "a".repeat(31);
      expect(() => validateHandle(longIg, getPlat("instagram"))).toThrow(
        /maximum allowed length of 30/i
      );

      // TikTok: max 24
      const longTt = "b".repeat(25);
      expect(() => validateHandle(longTt, getPlat("tiktok"))).toThrow(
        /maximum allowed length of 24/i
      );

      // X: max 15
      const longX = "c".repeat(16);
      expect(() => validateHandle(longX, getPlat("x"))).toThrow(
        /maximum allowed length of 15/i
      );
    });

    it("rejects illegal characters in handles", () => {
      expect(() => validateHandle("alice#creator", getPlat("instagram"))).toThrow(/Invalid handle format/i);
      expect(() => validateHandle("bob/creator", getPlat("x"))).toThrow(/Invalid handle format/i);
      expect(() => validateHandle("charlie!bang", getPlat("telegram"))).toThrow(/Invalid handle format/i);
    });
  });

  describe("2. Link Validation, Host Allowlist & MediaKey Extraction", () => {
    it("extracts mediaKey from Instagram post, reel, and tv links", () => {
      const resPost = validatePlatformLink("https://www.instagram.com/p/C3x91yZ_abc/", getPlat("instagram"));
      expect(resPost.valid).toBe(true);
      expect(resPost.mediaKey).toBe("C3x91yZ_abc");

      const resReel = validatePlatformLink("https://instagram.com/reel/D4y82zA/", getPlat("instagram"));
      expect(resReel.mediaKey).toBe("D4y82zA");
    });

    it("extracts mediaKey from TikTok video link and validates handle in URL", () => {
      const resTt = validatePlatformLink(
        "https://www.tiktok.com/@creator_alice/video/7123456789012345678",
        getPlat("tiktok"),
        "creator_alice"
      );
      expect(resTt.valid).toBe(true);
      expect(resTt.mediaKey).toBe("7123456789012345678");
      expect(resTt.urlHandle).toBe("creator_alice");
    });

    it("rejects TikTok link if handle in URL does not match package handle", () => {
      expect(() =>
        validatePlatformLink(
          "https://www.tiktok.com/@imposter_bob/video/7123456789012345678",
          getPlat("tiktok"),
          "creator_alice"
        )
      ).toThrow(/does not match the package handle/i);
    });

    it("extracts mediaKey from YouTube watch, shorts, and youtu.be links", () => {
      const resWatch = validatePlatformLink(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
        getPlat("youtube")
      );
      expect(resWatch.mediaKey).toBe("dQw4w9WgXcQ");

      const resShorts = validatePlatformLink(
        "https://youtube.com/shorts/dQw4w9WgXcQ",
        getPlat("youtube")
      );
      expect(resShorts.mediaKey).toBe("dQw4w9WgXcQ");

      const resYoutuBe = validatePlatformLink(
        "https://youtu.be/dQw4w9WgXcQ",
        getPlat("youtube")
      );
      expect(resYoutuBe.mediaKey).toBe("dQw4w9WgXcQ");
    });

    it("extracts mediaKey from Facebook reel and watch links", () => {
      const resFbReel = validatePlatformLink(
        "https://www.facebook.com/reel/123456789012345",
        getPlat("facebook")
      );
      expect(resFbReel.mediaKey).toBe("123456789012345");

      const resFbWatch = validatePlatformLink(
        "https://facebook.com/watch/?v=987654321098765",
        getPlat("facebook")
      );
      expect(resFbWatch.mediaKey).toBe("987654321098765");
    });

    it("extracts mediaKey from X status links and checks handle", () => {
      const resX = validatePlatformLink(
        "https://x.com/tech_insider/status/1789012345678901234",
        getPlat("x"),
        "tech_insider"
      );
      expect(resX.valid).toBe(true);
      expect(resX.mediaKey).toBe("1789012345678901234");
      expect(resX.urlHandle).toBe("tech_insider");
    });

    it("extracts mediaKey from Telegram post links", () => {
      const resTg = validatePlatformLink(
        "https://t.me/durov_channel/42",
        getPlat("telegram"),
        "durov_channel"
      );
      expect(resTg.mediaKey).toBe("42");
      expect(resTg.urlHandle).toBe("durov_channel");
    });
  });

  describe("3. Strict Short-Link Rejection & Host Verification (No Arbitrary URLs Fetched)", () => {
    it("rejects shortened URLs with clear explanatory error message", () => {
      const shortUrls = [
        "https://bit.ly/3xSample",
        "https://tinyurl.com/abc1234",
        "https://t.co/xyz9999",
        "https://goo.gl/maps/fake",
        "https://is.gd/shorty",
      ];

      for (const url of shortUrls) {
        expect(() => validatePlatformLink(url, getPlat("instagram"))).toThrow(
          "Shortened URLs are not permitted. Please provide the direct platform link."
        );
      }
    });

    it("rejects untrusted, third-party, or wrong-platform hosts", () => {
      // Wrong platform
      expect(() =>
        validatePlatformLink("https://www.tiktok.com/@user/video/123", getPlat("instagram"))
      ).toThrow(/Invalid host "www.tiktok.com" for Instagram/i);

      // Phishing / spoofed host
      expect(() =>
        validatePlatformLink("https://www.instagram.com.attacker.com/p/123", getPlat("instagram"))
      ).toThrow(/Invalid host/i);

      // Arbitrary external URL
      expect(() =>
        validatePlatformLink("https://example.com/some/path", getPlat("instagram"))
      ).toThrow(/Invalid host "example.com" for Instagram/i);
    });

    it("rejects non-URL strings without throwing uncaught runtime errors", () => {
      expect(() => validatePlatformLink("not-a-valid-url", getPlat("instagram"))).toThrow(
        /Invalid URL format/i
      );
    });
  });
});
