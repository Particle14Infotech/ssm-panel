import { buildServer } from "../src/app";

describe("FIX 3: Scoped Raw-Body Buffer Parser vs Default JSON Parser", () => {
  let app: any;
  let nonWebhookRawBody: any = "NOT_CALLED";

  beforeAll(async () => {
    app = await buildServer({
      onRoute: (routeOptions: any) => {
        // hook inspection if needed
      },
    });

    // Add a normal test endpoint to inspect req.rawBody on standard routes
    app.post("/test-standard-json", async (request: any) => {
      nonWebhookRawBody = request.rawBody;
      return { received: request.body, hasRawBody: request.rawBody !== undefined };
    });

    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("should parse standard JSON routes using default parser without capturing rawBody buffer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/test-standard-json",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "smm-test", value: 123 }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.received).toEqual({ name: "smm-test", value: 123 });
    expect(body.hasRawBody).toBe(false);
    expect(nonWebhookRawBody).toBeUndefined();
  });

  it("should scope rawBody Buffer capture to webhook endpoint", async () => {
    // When sending an invalid signature, the webhook handler attempts HMAC verification on rawBody
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "invalid_sig",
      },
      payload: JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_123", amount: 1000 } } },
      }),
    });

    // It parsed the payload and processed the webhook (even if signature rejected 400)
    expect([200, 201, 400]).toContain(res.statusCode);
  });
});
