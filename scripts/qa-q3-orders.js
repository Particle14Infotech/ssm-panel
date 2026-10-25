/**
 * Q3 Order, Track, Refund - Core Money Path Verification Suite
 * Tests against live running API on http://127.0.0.1:4000/api/v1
 */

const API_BASE = "http://127.0.0.1:4000/api/v1";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

let testPassed = 0;
let testFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    testFailed++;
  } else {
    console.log(`✅ [PASS] ${message}`);
    testPassed++;
  }
}

async function runQ3() {
  console.log("================================================================================");
  console.log("▶ STARTING Q3: ORDER, TRACK, REFUND VERIFICATION SUITE");
  console.log(`API Base: ${API_BASE}`);
  console.log("================================================================================\n");

  const ts = Date.now();
  const testEmail = `qa_orders_${ts}@smm.dev`;
  const securePassword = "Password123!Secure";

  // ---------------------------------------------------------------------------
  // SETUP: REGISTER TEST USER
  // ---------------------------------------------------------------------------
  console.log("--- Setup: User Registration & Zero Balance Verification ---");
  const regRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmail, password: securePassword, name: "Orders Test User" }),
  });
  assert(regRes.status === 201 || regRes.status === 200, `Registered test user (status ${regRes.status})`);
  const token = regRes.data?.token;
  assert(!!token, `JWT token received for order operations`);

  const initialBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(initialBalRes.status === 200, `GET /wallet/balance returns 200 OK`);
  const initialBalance = Number(initialBalRes.data?.balance);
  assert(initialBalance === 0, `Initial balance is exactly ₹0.00 (got ₹${initialBalance})`);

  // ---------------------------------------------------------------------------
  // 1. ORD-02: INSUFFICIENT FUNDS SAFEGUARD (HTTP 402 PAYMENT REQUIRED)
  // ---------------------------------------------------------------------------
  console.log("\n--- 1. ORD-02: Insufficient Funds Safeguard (HTTP 402) ---");

  const zeroBalOrderRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      serviceId: "1042", // Instagram Followers, rate ₹180/1k
      target: "https://instagram.com/p/test_zero",
      quantity: 1000,
    }),
  });
  assert(
    zeroBalOrderRes.status === 402,
    `Order with zero balance returns HTTP 402 Payment Required (got ${zeroBalOrderRes.status})`
  );
  assert(
    zeroBalOrderRes.data?.message?.toLowerCase().includes("insufficient") ||
    zeroBalOrderRes.data?.code === "PAYMENT_REQUIRED",
    `Error message clearly indicates insufficient balance: "${zeroBalOrderRes.data?.message}"`
  );

  // Check balance is still 0
  const postFailBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postFailBalance = Number(postFailBalRes.data?.balance);
  assert(postFailBalance === 0, `Wallet balance remains exactly ₹0.00 after blocked order`);

  // ---------------------------------------------------------------------------
  // 2. ADD FUNDS FOR ORDER TESTING
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Add Funds (₹500 Deposit + ₹25 Bonus) ---");

  const depositRes = await request("/payments/create-order", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount: 500 }),
  });
  assert(depositRes.status === 200 || depositRes.status === 201, `Payment order created`);
  const gatewayOrderId = depositRes.data?.gatewayOrderId || depositRes.data?.id;

  const completeRes = await request("/payments/sandbox-complete", {
    method: "POST",
    body: JSON.stringify({ gatewayOrderId }),
  });
  assert(completeRes.status === 200 || completeRes.status === 201, `Deposit completed via sandbox`);

  const fundedBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const fundedBalance = Number(fundedBalRes.data?.balance);
  assert(fundedBalance === 525, `Wallet funded to ₹525.00 (₹500 deposit + ₹25 bonus, got ₹${fundedBalance})`);

  // ---------------------------------------------------------------------------
  // 3. ORD-01 & ORD-03: VALID ORDER CREATION & ATOMIC DEBIT & IDEMPOTENCY
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. ORD-01 & ORD-03: Order Placement, Pricing & Idempotency ---");

  const idempotencyKey = `idem_q3_${ts}_order1`;
  const orderPayload = {
    serviceId: "1042", // Instagram Followers, rate ₹180/1k
    target: "https://instagram.com/p/test_order_1",
    quantity: 1000,
    idempotencyKey,
  };

  const order1Res = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(orderPayload),
  });
  assert(order1Res.status === 201 || order1Res.status === 200, `Order placed successfully (status ${order1Res.status})`);
  const order1 = order1Res.data;
  assert(!!order1?.id, `Received valid order ID: "${order1?.id}"`);
  assert(Number(order1?.charge) === 180, `Order charge calculated correctly as ₹180.00 (got ₹${order1?.charge})`);
  assert(order1?.status === "PENDING", `Order initial status is PENDING (got "${order1?.status}")`);
  assert(order1?.remains === 1000, `Order initial remains equals quantity: ${order1?.remains}`);

  // Balance debit verification
  const postOrderBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postOrderBalance = Number(postOrderBalRes.data?.balance);
  assert(
    postOrderBalance === 345,
    `Wallet atomically debited by ₹180: ₹525 - ₹180 = ₹345 (got ₹${postOrderBalance})`
  );

  // Idempotency replay check: Send exact same request with same idempotencyKey
  const replayOrderRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(orderPayload),
  });
  assert(
    replayOrderRes.status === 200 || replayOrderRes.status === 201,
    `Replaying order with same idempotencyKey succeeds (status ${replayOrderRes.status})`
  );
  assert(
    replayOrderRes.data?.id === order1?.id,
    `Idempotent replay returns exact same order ID: "${replayOrderRes.data?.id}"`
  );

  // Verify balance was NOT debited a second time
  const postReplayBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postReplayBalance = Number(postReplayBalRes.data?.balance);
  assert(
    postReplayBalance === 345,
    `Balance unchanged after idempotent replay (still ₹${postReplayBalance})`
  );

  // ---------------------------------------------------------------------------
  // 4. ORD-04 & ORD-08: ORDER TRACKING & DETAILS
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. ORD-04 & ORD-08: Order Tracking & Querying ---");

  // List all orders for user
  const listOrdersRes = await request("/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(listOrdersRes.status === 200, `GET /orders returns 200 OK`);
  assert(Array.isArray(listOrdersRes.data), `GET /orders returns an array`);
  const foundOrder = listOrdersRes.data?.find((o) => o.id === order1?.id);
  assert(!!foundOrder, `Order #${order1?.id} found in user's order list`);

  // Single order lookup
  const singleOrderRes = await request(`/orders/${order1?.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(singleOrderRes.status === 200, `GET /orders/:id returns 200 OK`);
  assert(singleOrderRes.data?.id === order1?.id, `Fetched order has matching ID`);
  assert(singleOrderRes.data?.status === "PENDING", `Fetched order status is PENDING`);
  assert(
    Array.isArray(singleOrderRes.data?.history) && singleOrderRes.data.history.length > 0,
    `Order includes history timeline entries (count: ${singleOrderRes.data?.history?.length})`
  );

  // ---------------------------------------------------------------------------
  // 5. ORD-05: FAILURE DRILL & AUTOMATIC REFUND
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. ORD-05: Failure Drill & Auto-Refund (srv_mock_fail) ---");

  // Service srv_mock_fail (rate 200, qty 1000 -> charge 200)
  const failOrderRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      serviceId: "srv_mock_fail",
      target: "https://x.com/user/status/drill_fail",
      quantity: 1000,
    }),
  });
  assert(failOrderRes.status === 201 || failOrderRes.status === 200, `Drill order submitted`);
  const drillOrder = failOrderRes.data;
  assert(drillOrder?.status === "FAILED", `Drill order status is FAILED as expected (got "${drillOrder?.status}")`);

  // Balance should have been debited ₹200 and immediately refunded ₹200 -> net balance remains ₹345
  const postDrillBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postDrillBalance = Number(postDrillBalRes.data?.balance);
  assert(
    postDrillBalance === 345,
    `Balance automatically restored after failure drill: ₹345 (got ₹${postDrillBalance})`
  );

  // ---------------------------------------------------------------------------
  // 6. ORD-07: ORDER CANCELLATION & WALLET REFUND
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. ORD-07: Order Cancellation & Full Refund ---");

  const cancelRes = await request(`/orders/${order1?.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(cancelRes.status === 200 || cancelRes.status === 201, `POST /orders/:id/cancel returns success (status ${cancelRes.status})`);
  assert(cancelRes.data?.success === true, `Cancel response reports success: true`);
  assert(
    cancelRes.data?.order?.status === "CANCELLED",
    `Order status updated to CANCELLED (got "${cancelRes.data?.order?.status}")`
  );

  // Balance restored by ₹180: ₹345 + ₹180 = ₹525
  const postCancelBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const postCancelBalance = Number(postCancelBalRes.data?.balance);
  assert(
    postCancelBalance === 525,
    `Wallet credited with full refund: ₹345 + ₹180 = ₹525.00 (got ₹${postCancelBalance})`
  );

  // Re-cancelling must fail (409 Conflict)
  const reCancelRes = await request(`/orders/${order1?.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(
    reCancelRes.status === 409 || reCancelRes.status === 400,
    `Cancelling already-cancelled order is rejected with 409 Conflict (got ${reCancelRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 7. ORD-09: FINANCIAL INVARIANT AUDIT
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. ORD-09: Double-Entry Financial Invariant Audit ---");

  const ledgerRes = await request("/wallet/ledger", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(ledgerRes.status === 200, `GET /wallet/ledger returns 200 OK`);
  const ledgerEntries = ledgerRes.data || [];
  assert(Array.isArray(ledgerEntries), `Ledger entries is array (count: ${ledgerEntries.length})`);

  let calculatedBalance = 0;
  for (const entry of ledgerEntries) {
    calculatedBalance += Number(entry.amount);
  }

  console.log(`Live wallet balance: ₹${postCancelBalance}`);
  console.log(`Sum of all ledger entries: ₹${calculatedBalance}`);
  assert(
    Math.abs(calculatedBalance - postCancelBalance) < 0.001,
    `Financial Invariant Preserved: Live balance (₹${postCancelBalance}) matches sum of ledger entries (₹${calculatedBalance})`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`Q3 VERIFICATION COMPLETE: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("================================================================================\n");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runQ3().catch((err) => {
  console.error("FATAL ERROR running Q3 verification:", err);
  process.exit(1);
});
