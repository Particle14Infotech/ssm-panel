import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import {
  validatePlatformLink,
  DEFAULT_PLATFORM_CONFIGS,
} from "../src/modules/platforms/platform-rules.util";
import { PackagesService } from "../src/modules/packages/packages.service";
import * as fs from "fs";
import * as path from "path";

describe("S6: Extra Hardening (URL, Raw SQL, CHECK Constraint, Admin Guards)", () => {
  const instagramConfig = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "instagram")!;

  describe("1. WHATWG URL Validation Hardening", () => {
    it("rejects URLs exceeding 2048 characters", () => {
      const longUrl = "https://instagram.com/p/" + "a".repeat(2050);
      expect(() => validatePlatformLink(longUrl, instagramConfig)).toThrow(BadRequestException);
    });

    it("strictly rejects non-https schemes (http, javascript, data, ftp)", () => {
      const schemes = [
        "http://instagram.com/p/CgK12345678/",
        "javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "ftp://instagram.com/p/CgK12345678/",
      ];
      for (const url of schemes) {
        expect(() => validatePlatformLink(url, instagramConfig)).toThrow(BadRequestException);
      }
    });

    it("strictly rejects URLs containing userinfo (credentials)", () => {
      const userinfoUrls = [
        "https://admin:password@instagram.com/p/CgK12345678/",
        "https://attacker@instagram.com/p/CgK12345678/",
      ];
      for (const url of userinfoUrls) {
        expect(() => validatePlatformLink(url, instagramConfig)).toThrow(BadRequestException);
      }
    });

    it("strictly rejects URLs containing non-default ports", () => {
      const badPortUrls = [
        "https://instagram.com:8080/p/CgK12345678/",
        "https://instagram.com:8443/p/CgK12345678/",
        "https://instagram.com:3000/p/CgK12345678/",
      ];
      for (const url of badPortUrls) {
        expect(() => validatePlatformLink(url, instagramConfig)).toThrow(BadRequestException);
      }
    });

    it("strictly rejects IDN / Punycode lookalike domains and non-ASCII hostnames", () => {
      const punyUrls = [
        "https://xn--nstagram-m1a.com/p/CgK12345678/",
        "https://instagram.com.xn--p1ai/p/CgK12345678/",
        "https://instägram.com/p/CgK12345678/",
      ];
      for (const url of punyUrls) {
        expect(() => validatePlatformLink(url, instagramConfig)).toThrow(BadRequestException);
      }
    });

    it("strictly rejects lookalike domain suffixes (evil-instagram.com, instagram.com.evil.com)", () => {
      const lookalikes = [
        "https://evil-instagram.com/p/CgK12345678/",
        "https://instagram.com.evil.com/p/CgK12345678/",
        "https://notinstagram.com/p/CgK12345678/",
      ];
      for (const url of lookalikes) {
        expect(() => validatePlatformLink(url, instagramConfig)).toThrow(BadRequestException);
      }
    });

    it("survives ReDoS fuzz testing of 10,000 hostile strings under 100ms", () => {
      const hostilePrefixes = [
        "https://instagram.com/p/",
        "https://tiktok.com/@",
        "https://youtube.com/watch?v=",
        "https://x.com/status/",
      ];
      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        const hostile = hostilePrefixes[i % hostilePrefixes.length] + "a/".repeat(20) + "!@#$%^&*()_+~";
        try {
          validatePlatformLink(hostile, instagramConfig);
        } catch {
          // Expected failure
        }
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe("2. Database CHECK Constraint Verification", () => {
    it("verifies migration files define check_used_count constraint on PackageRule", () => {
      const migrationDir = path.resolve(__dirname, "../../../prisma/migrations");
      const migrationFiles = fs.readdirSync(migrationDir, { recursive: true }) as string[];
      let foundCheckConstraint = false;

      for (const file of migrationFiles) {
        if (file.endsWith(".sql")) {
          const content = fs.readFileSync(path.join(migrationDir, file), "utf-8");
          if (
            content.includes('"usedCount" <= "maxPosts"') &&
            (content.includes("check_used_count_le_max_posts") || content.includes("check_used_count_max_posts"))
          ) {
            foundCheckConstraint = true;
            break;
          }
        }
      }
      expect(foundCheckConstraint).toBe(true);
    });
  });

  describe("3. Admin Endpoints Hardening (Reason >= 10 chars, Fail-Closed, Audit)", () => {
    let service: PackagesService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        isConnected: true,
        packageExecution: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        order: {
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: "audit-1" }),
        },
      };
      service = new PackagesService(mockPrisma as any, {} as any, {} as any);
    });

    it("rejects admin resolve execution with missing or short reason (< 10 chars)", async () => {
      mockPrisma.packageExecution.findUnique.mockResolvedValue({
        id: "exec-1",
        status: "STALLED",
        packageId: "pkg-1",
      });

      // Missing reason
      await expect(
        service.adminResolveExecution("exec-1", "REFUND", { reason: "" })
      ).rejects.toThrow(BadRequestException);

      // Short reason (< 10 chars)
      await expect(
        service.adminResolveExecution("exec-1", "REFUND", { reason: "short" })
      ).rejects.toThrow(BadRequestException);
    });

    it("fails closed (503 ServiceUnavailableException) when DB is disconnected in adminResolveExecution", async () => {
      mockPrisma.isConnected = false;
      await expect(
        service.adminResolveExecution("exec-1", "RETRY", { reason: "Valid reason over 10 chars" })
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
