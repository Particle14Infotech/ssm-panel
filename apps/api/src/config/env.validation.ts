import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().default("6379"),
  JWT_ACCESS_SECRET: z.string().default("test_access_secret_32bytes_minimum_length_required"),
  JWT_REFRESH_SECRET: z.string().default("test_refresh_secret_32bytes_minimum_length_required"),
  WEB_URL: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().optional(),
  API_URL: z.string().default("http://localhost:4000/api/v1"),
  PAYMENTS_MODE: z.string().optional().default("sandbox"),
  PAYMENT_PROVIDER: z.enum(["simulated", "razorpay"]).default("simulated"),
  ALLOW_SIMULATED_PAYMENTS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

export function validateEnvironment(env: Record<string, string | undefined> = process.env): ValidatedEnv {
  const isProduction = env.NODE_ENV === "production";
  const paymentProvider = env.PAYMENT_PROVIDER || "simulated";

  if (isProduction) {
    const criticalVars = [
      "DATABASE_URL",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
    ];

    const hasRedis =
      (env.REDIS_URL && !env.REDIS_URL.startsWith("REPLACE_ME")) ||
      (env.REDIS_HOST && !env.REDIS_HOST.startsWith("REPLACE_ME"));

    const missing = criticalVars.filter((v) => {
      const val = env[v];
      return !val || val.trim() === "" || val.startsWith("REPLACE_ME");
    });

    if (!hasRedis) {
      missing.push("REDIS_URL or REDIS_HOST");
    }

    // Production guard for payments
    if (paymentProvider === "simulated") {
      if (env.ALLOW_SIMULATED_PAYMENTS !== "true") {
        missing.push("ALLOW_SIMULATED_PAYMENTS (Simulated payments in production requires ALLOW_SIMULATED_PAYMENTS=true)");
      } else {
        console.warn("\n=======================================================");
        console.warn("[Payments Guard] WARNING: Running with SIMULATED payments in PRODUCTION mode. No real money will be charged.");
        console.warn("=======================================================\n");
      }
    } else if (paymentProvider === "razorpay") {
      ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"].forEach((v) => {
        const val = env[v];
        if (!val || val.trim() === "" || val.startsWith("REPLACE_ME")) {
          missing.push(v);
        }
      });
    }

    if (missing.length > 0) {
      console.error("\n=======================================================");
      console.error("FATAL: PRODUCTION BOOT REFUSED - MISSING SECRETS");
      console.error("=======================================================");
      missing.forEach((v) => console.error(`  - Missing or placeholder: ${v}`));
      console.error("\nSet valid production credentials in the environment.\n");
      process.exit(1);
    }
  }

  const result = EnvSchema.safeParse(env);
  if (!result.success && isProduction) {
    console.error("FATAL: Environment validation failed:", result.error.format());
    process.exit(1);
  }

  return (result.success ? result.data : env) as ValidatedEnv;
}
