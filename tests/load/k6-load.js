import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    smm_load: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "10s", target: 50 },
        { duration: "20s", target: 50 },
        { duration: "5s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    "http_req_duration{endpoint:catalog}": ["p(95)<200"],
    "http_req_duration{endpoint:dashboard}": ["p(95)<300"],
    "http_req_duration{endpoint:place_order}": ["p(95)<500"],
    "http_req_failed": ["rate<0.01"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000/api/v1";

export default function () {
  // 1. Login
  const loginPayload = JSON.stringify({
    email: "alex.vance@smm-panel.io",
    password: "SecurePassword123!",
  });
  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { "Content-Type": "application/json" },
    tags: { endpoint: "login" },
  });
  check(loginRes, {
    "login status is 201 or 200": (r) => r.status === 200 || r.status === 201,
  });

  const authToken = loginRes.json("token") || "jwt_smm_fallback";
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  // 2. Browse Catalog (Cached)
  const catalogRes = http.get(`${BASE_URL}/services`, {
    headers: authHeaders,
    tags: { endpoint: "catalog" },
  });
  check(catalogRes, {
    "catalog status is 200": (r) => r.status === 200,
    "catalog p95 within bounds": (r) => r.timings.duration < 200,
  });

  // 3. Dashboard Summary (Wallet balance + health live)
  const dashboardRes = http.get(`${BASE_URL}/wallet/balance`, {
    headers: authHeaders,
    tags: { endpoint: "dashboard" },
  });
  check(dashboardRes, {
    "dashboard status is 200": (r) => r.status === 200,
  });

  // 4. Place Order with unique Idempotency-Key
  const uniqueIdempotencyKey = `idem_${__VU}_${__ITER}_${Date.now()}`;
  const orderPayload = JSON.stringify({
    serviceId: "1042",
    target: "https://instagram.com/neural.growth",
    quantity: 1000,
  });
  const orderRes = http.post(`${BASE_URL}/orders/create`, orderPayload, {
    headers: {
      ...authHeaders,
      "Idempotency-Key": uniqueIdempotencyKey,
    },
    tags: { endpoint: "place_order" },
  });
  check(orderRes, {
    "order created successfully": (r) => r.status === 201 || r.status === 200,
  });

  let createdOrderId = orderRes.json("id") || "ORD-98421";

  // 5. Payment Webhook Burst Simulation (Simulate gateway deposit credit)
  const webhookPayload = JSON.stringify({
    amount: 500,
    method: "UPI",
    referenceId: `REF-${uniqueIdempotencyKey}`,
  });
  const webhookRes = http.post(`${BASE_URL}/wallet/deposit`, webhookPayload, {
    headers: authHeaders,
    tags: { endpoint: "webhook_burst" },
  });
  check(webhookRes, {
    "deposit acknowledged": (r) => r.status === 201 || r.status === 200,
  });

  // 6. Order Status Polling
  const pollRes = http.get(`${BASE_URL}/orders/${createdOrderId}`, {
    headers: authHeaders,
    tags: { endpoint: "order_poll" },
  });
  check(pollRes, {
    "order poll status is 200": (r) => r.status === 200,
  });

  sleep(0.1);
}
