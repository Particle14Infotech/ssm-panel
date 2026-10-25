import { validateEnvironment } from "../src/config/env.validation";
import * as fs from "fs";
import * as path from "path";

describe("S4: GAP-4 Secrets Hardening Repo-Wide", () => {
  describe("1. Production Boot Validation & Refusal Rules", () => {
    const validProdEnv = {
      NODE_ENV: "production",
      PORT: "4000",
      DATABASE_URL: "postgresql://user:pass@ep-prod.neon.tech/smm_prod",
      REDIS_URL: "redis://default:complex_redis_password_32bytes_long@redis.internal:6379",
      JWT_ACCESS_SECRET: "strong_production_access_secret_minimum_32_chars!",
      JWT_REFRESH_SECRET: "strong_production_refresh_secret_minimum_32_chars!",
      COOKIE_SECRET: "strong_production_cookie_secret_minimum_32_chars!!",
      ENCRYPTION_KEY: "strong_production_encryption_key_32chars_long!",
      QUOTE_SECRET: "strong_production_quote_secret_distinct_32chars!",
      PAYMENT_PROVIDER: "razorpay",
      RAZORPAY_KEY_ID: "rzp_live_12345678901234",
      RAZORPAY_KEY_SECRET: "rzp_secret_production_32chars_long_key!",
      PAYMENT_WEBHOOK_SECRET: "webhook_secret_production_32chars_long_key!",
    };

    it("passes validation with strong, distinct, >= 32-char production secrets", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {}) as any);
      const validated = validateEnvironment(validProdEnv);
      expect(exitSpy).not.toHaveBeenCalled();
      expect(validated.NODE_ENV).toBe("production");
      exitSpy.mockRestore();
    });

    it("refuses boot when QUOTE_SECRET is missing or placeholder in production", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("PROCESS_EXIT_CALLED");
      }) as any);

      const invalidEnv = { ...validProdEnv, QUOTE_SECRET: "" };
      expect(() => validateEnvironment(invalidEnv)).toThrow("PROCESS_EXIT_CALLED");

      const placeholderEnv = { ...validProdEnv, QUOTE_SECRET: "REPLACE_ME_QUOTE_SECRET" };
      expect(() => validateEnvironment(placeholderEnv)).toThrow("PROCESS_EXIT_CALLED");

      exitSpy.mockRestore();
    });

    it("refuses boot when any secret is under 32 characters in production", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("PROCESS_EXIT_CALLED");
      }) as any);

      const weakEnv = { ...validProdEnv, QUOTE_SECRET: "too_short_secret" };
      expect(() => validateEnvironment(weakEnv)).toThrow("PROCESS_EXIT_CALLED");

      const weakJwt = { ...validProdEnv, JWT_ACCESS_SECRET: "short_jwt_secret" };
      expect(() => validateEnvironment(weakJwt)).toThrow("PROCESS_EXIT_CALLED");

      exitSpy.mockRestore();
    });

    it("refuses boot when secrets match known weak defaults or denylist", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("PROCESS_EXIT_CALLED");
      }) as any);

      const denylistedEnv = {
        ...validProdEnv,
        QUOTE_SECRET: "smm-package-quote-integrity-salt", // Exactly GAP-4
      };
      expect(() => validateEnvironment(denylistedEnv)).toThrow("PROCESS_EXIT_CALLED");

      const changemeEnv = {
        ...validProdEnv,
        COOKIE_SECRET: "changeme_changeme_changeme_changeme",
      };
      expect(() => validateEnvironment(changemeEnv)).toThrow("PROCESS_EXIT_CALLED");

      exitSpy.mockRestore();
    });

    it("refuses boot when QUOTE_SECRET equals JWT_ACCESS_SECRET (must be mutually distinct)", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("PROCESS_EXIT_CALLED");
      }) as any);

      const duplicateEnv = {
        ...validProdEnv,
        QUOTE_SECRET: validProdEnv.JWT_ACCESS_SECRET,
      };
      expect(() => validateEnvironment(duplicateEnv)).toThrow("PROCESS_EXIT_CALLED");

      exitSpy.mockRestore();
    });

    it("refuses boot when NODE_ENV is unset, empty, or an invalid value", () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("PROCESS_EXIT_CALLED");
      }) as any);

      expect(() => validateEnvironment({ ...validProdEnv, NODE_ENV: "staging" as any })).toThrow("PROCESS_EXIT_CALLED");
      expect(() => validateEnvironment({ ...validProdEnv, NODE_ENV: "" as any })).toThrow("PROCESS_EXIT_CALLED");

      exitSpy.mockRestore();
    });
  });

  describe("2. Static Source Gate: Zero '|| literal' Secret Fallbacks in Production Code", () => {
    it("proves no hardcoded secret literals exist in apps/api and apps/worker source code", () => {
      const srcRoots = [
        path.resolve(__dirname, "../src"),
        path.resolve(__dirname, "../../worker/src"),
      ];

      const forbiddenLiteralPatterns = [
        /process\.env\.(?:JWT_|QUOTE_|COOKIE_|ENCRYPTION_|WEBHOOK_)[A-Z_]*\s*\|\|\s*["'`][^"'`]+["'`]/,
        /process\.env\.(?:JWT_|QUOTE_|COOKIE_|ENCRYPTION_|WEBHOOK_)[A-Z_]*\s*\?\?\s*["'`][^"'`]+["'`]/,
        /["']smm-package-quote-integrity-salt["']/,
        /["']smm_master_provider_key_fallback_dev["']/,
        /["']smm_panel_jwt_secret_dev_environment_key_32bytes["']/,
      ];

      const violations: string[] = [];

      function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".turbo") {
              scanDir(fullPath);
            }
          } else if (
            (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
            !entry.name.endsWith(".spec.ts") &&
            !entry.name.endsWith(".test.ts") &&
            entry.name !== "env.validation.ts"
          ) {
            const content = fs.readFileSync(fullPath, "utf-8");
            for (const pattern of forbiddenLiteralPatterns) {
              if (pattern.test(content)) {
                violations.push(`${fullPath}: matched forbidden pattern ${pattern}`);
              }
            }
          }
        }
      }

      for (const root of srcRoots) {
        scanDir(root);
      }

      expect(violations).toEqual([]);
    });
  });
});
