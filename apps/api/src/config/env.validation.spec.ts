import { validateEnvironment } from "./env.validation";

const productionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://test:test@localhost/test",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  RESEND_API_KEY: "test-resend-key",
};

describe("production payment environment validation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      "explicit simulated provider",
      {
        PAYMENT_PROVIDER: "simulated",
        ALLOW_SIMULATED_PAYMENTS: "true",
        PAYMENTS_MODE: "sandbox",
      },
    ],
    [
      "missing provider with sandbox mode",
      {
        ALLOW_SIMULATED_PAYMENTS: "true",
        PAYMENTS_MODE: "sandbox",
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
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "test-key-secret",
    });

    expect(env.PAYMENT_PROVIDER).toBe("razorpay");
  });
});
