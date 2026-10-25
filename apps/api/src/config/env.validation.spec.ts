import { validateEnvironment } from "./env.validation";

const productionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://test:test@localhost/test",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "prod_jwt_access_secret_32_characters_long_abcdef",
  JWT_REFRESH_SECRET: "prod_jwt_refresh_secret_32_characters_long_bcdefa",
  COOKIE_SECRET: "prod_cookie_val_32_characters_long_cdefab",
  ENCRYPTION_KEY: "prod_encryption_val_32_characters_long_defabc",
  QUOTE_SECRET: "prod_quote_val_32_characters_long_efabcd",
  RESEND_API_KEY: "prod_resend_api_val_32_characters_long_fabcde",
};

describe("production payment environment validation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      "explicit simulated provider without simulation flag",
      {
        PAYMENT_PROVIDER: "simulated",
        ALLOW_SIMULATED_PAYMENTS: "false",
        PAYMENTS_MODE: "production",
      },
    ],
    [
      "missing provider without simulation flag",
      {
        ALLOW_SIMULATED_PAYMENTS: "false",
        PAYMENTS_MODE: "production",
      },
    ],
  ])("refuses production startup for %s", (_description, paymentSettings) => {
    const exit = jest
      .spyOn(process, "exit")
      .mockImplementation((code?: number): never => {
        throw new Error(`process.exit:${code}`);
      });

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        ...paymentSettings,
      })
    ).toThrow("process.exit:1");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("accepts an explicitly configured Razorpay provider", () => {
    const env = validateEnvironment({
      ...productionEnvironment,
      PAYMENT_PROVIDER: "razorpay",
      RAZORPAY_KEY_ID: "rzp_live_test_key_id",
      RAZORPAY_KEY_SECRET: "rzp_live_test_key_secret",
      PAYMENT_WEBHOOK_SECRET: "prod_webhook_val_32_characters_long_abcdef",
    });

    expect(env.PAYMENT_PROVIDER).toBe("razorpay");
  });
});
