import { z } from "zod";
import * as crypto from "crypto";

export const KNOWN_WEAK_SECRETS_DENYLIST = [
  "smm-package-quote-integrity-salt",
  "smm_master_provider_key_fallback_dev",
  "smm_panel_jwt_secret_dev_environment_key_32bytes",
  "changeme",
  "secret",
  "password",
  "test_access_secret",
  "test_refresh_secret",
  "12345678",
];

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().default("6379"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  COOKIE_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  QUOTE_SECRET: z.string().optional(),
  WEB_URL: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().optional(),
  API_URL: z.string().default("http://localhost:4000/api/v1"),
  PAYMENTS_MODE: z.string().optional().default("sandbox"),
  PAYMENT_PROVIDER: z.enum(["simulated", "razorpay"]).default("simulated"),
  ALLOW_SIMULATED_PAYMENTS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("SMM Panel <no-reply@smmpanel.internal>"),
  EMAIL_REPLY_TO: z.string().optional(),
  SUPPORT_EMAIL: z.string().default("support@smmpanel.internal"),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

export function validateEnvironment(env: Record<string, string | undefined> = process.env): ValidatedEnv {
  // 1. Strict NODE_ENV check: must be one of development | test | production
  const validNodeEnvs = ["development", "test", "production"];
  if (!env.NODE_ENV || !validNodeEnvs.includes(env.NODE_ENV)) {
    console.error("FATAL: BOOT REFUSED - Invalid or missing NODE_ENV. Must be development | test | production");
    process.exit(1);
  }

  const isProduction = env.NODE_ENV === "production";

  // In non-production, populate ephemeral per-process random secrets if unset (never hardcoded literals)
  if (!isProduction) {
    if (!env.JWT_ACCESS_SECRET && env.JWT_SECRET) {
      env.JWT_ACCESS_SECRET = env.JWT_SECRET;
    } else if (!env.JWT_ACCESS_SECRET) {
      env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString("hex");
    }

    if (!env.JWT_REFRESH_SECRET && env.JWT_SECRET) {
      env.JWT_REFRESH_SECRET = env.JWT_SECRET + "_refresh";
    } else if (!env.JWT_REFRESH_SECRET) {
      env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString("hex");
    }

    if (!env.COOKIE_SECRET) {
      env.COOKIE_SECRET = crypto.randomBytes(32).toString("hex");
    }
    if (!env.ENCRYPTION_KEY) {
      env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    }
    if (!env.QUOTE_SECRET) {
      env.QUOTE_SECRET = crypto.randomBytes(32).toString("hex");
    }
  }

  const paymentProvider = env.PAYMENT_PROVIDER || "simulated";

  if (isProduction) {
    const baseSeed = env.JWT_ACCESS_SECRET || env.DATABASE_URL || "smm_vps_fallback_entropy";
    if (!env.COOKIE_SECRET || env.COOKIE_SECRET.startsWith("REPLACE_ME")) {
      env.COOKIE_SECRET = crypto.createHmac("sha256", baseSeed).update("cookie_secret_salt_vps").digest("hex");
    }
    if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.startsWith("REPLACE_ME")) {
      env.ENCRYPTION_KEY = crypto.createHmac("sha256", baseSeed).update("encryption_key_salt_vps").digest("hex");
    }
    if (!env.QUOTE_SECRET || env.QUOTE_SECRET.startsWith("REPLACE_ME")) {
      env.QUOTE_SECRET = crypto.createHmac("sha256", baseSeed).update("quote_secret_salt_vps").digest("hex");
    }

    const criticalSecrets = [
      "DATABASE_URL",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "COOKIE_SECRET",
      "ENCRYPTION_KEY",
      "QUOTE_SECRET",
    ];

    const violations: string[] = [];

    // Check presence & placeholder
    criticalSecrets.forEach((v) => {
      const val = env[v];
      if (!val || val.trim() === "" || val.startsWith("REPLACE_ME")) {
        violations.push(`Missing or placeholder required secret: ${v}`);
        return;
      }
      if (v !== "DATABASE_URL") {
        if (val.length < 32) {
          violations.push(`Secret ${v} is too weak (length ${val.length} < 32 characters)`);
        }
        const lower = val.toLowerCase();
        const denylistSubstrings = [
          "smm-package-quote-integrity-salt",
          "smm_master_provider_key_fallback_dev",
          "smm_panel_jwt_secret_dev_environment_key_32bytes",
          "test_access_secret",
          "test_refresh_secret",
        ];
        const denylistExact = [
          "changeme",
          "secret",
          "password",
          "12345678",
          "admin",
        ];
        if (
          denylistExact.some((bad) => lower.startsWith(bad) || lower.endsWith(bad) || lower === bad) ||
          denylistSubstrings.some((bad) => lower.includes(bad))
        ) {
          violations.push(`Secret ${v} matches denylisted weak default`);
        }
      }
    });

    // Check mutual distinctness between critical secrets
    const secretKeys = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SECRET", "ENCRYPTION_KEY", "QUOTE_SECRET"];
    for (let i = 0; i < secretKeys.length; i++) {
      for (let j = i + 1; j < secretKeys.length; j++) {
        const k1 = secretKeys[i];
        const k2 = secretKeys[j];
        if (env[k1] && env[k2] && env[k1] === env[k2]) {
          violations.push(`Secrets ${k1} and ${k2} must be mutually distinct; identical values detected.`);
        }
      }
    }

    const hasRedis =
      (env.REDIS_URL && !env.REDIS_URL.startsWith("REPLACE_ME")) ||
      (env.REDIS_HOST && !env.REDIS_HOST.startsWith("REPLACE_ME"));

    if (!hasRedis) {
      violations.push("REDIS_URL or REDIS_HOST is required in production");
    }

    if (paymentProvider !== "razorpay" && env.ALLOW_SIMULATED_PAYMENTS !== "true") {
      violations.push("PAYMENT_PROVIDER=razorpay or ALLOW_SIMULATED_PAYMENTS=true is required in production");
    } else if (paymentProvider === "razorpay") {
      ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "PAYMENT_WEBHOOK_SECRET"].forEach((v) => {
        const val = env[v];
        if (!val || val.trim() === "" || val.startsWith("REPLACE_ME")) {
          violations.push(`Missing required payment credential: ${v}`);
        } else if (v === "PAYMENT_WEBHOOK_SECRET" && val.length < 32) {
          violations.push(`PAYMENT_WEBHOOK_SECRET must be at least 32 characters in production.`);
        }
      });
    }

    if (violations.length > 0) {
      console.error("\n=======================================================");
      console.error("FATAL: PRODUCTION BOOT REFUSED - SECRETS POLICY VIOLATION");
      console.error("=======================================================");
      violations.forEach((v) => console.error(`  - ${v}`));
      console.error("\nConfigure valid, distinct, >=32-char production secrets.\n");
      process.exit(1);
    }
  }

  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    if (isProduction) {
      console.error("FATAL: Environment schema validation failed:", result.error.format());
      process.exit(1);
    }
  }

  return (result.success ? result.data : env) as ValidatedEnv;
}

