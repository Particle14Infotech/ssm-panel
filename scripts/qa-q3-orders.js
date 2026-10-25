/**
 * Q3 Order, Track & Refund Functional Verification Suite
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
  console.log("▶ STARTING Q3: ORDER, TRACK & REFUND VERIFICATION SUITE");
  console.log(`API Base: ${API_BASE}`);
  console.log("================================================================================\n");

  const ts = Date.now();
  const testEmailFunded = `qa_order_funded_${ts}@smm.dev`;
  const testEmailZero = `qa_order_zero_${ts}@smm.dev`;
  const securePassword = "Password123!Secure";

  // ---------------------------------------------------------------------------
  // 1. INSUFFICIENT BALANCE SAFEGUARD (ORD-02)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Insufficient Funds Safeguard (ORD-02) ---");

  const regZero = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmailZero, password: securePassword, name: "Zero Balance User" }),
  });
  assert(regZero.status === 201 || regZero.status === 200, `Registered zero-balance test user (status ${regZero.status})`);
  const tokenZero = regZero.data?.token;
  assert(!!tokenZero, `Received JWT token for zero-balance customer`);

  // Attempt order without funds -> must return HTTP 402 Payment Required
  const failOrderRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenZero}` },
    body: JSON.stringify({
      serviceId: "1042",
      target: "https://instagram.com/p/zero_test",
      quantity: 1000,
    }),
  });

  assert(
    failOrderRes.status === 402,
    `Unfunded order rejected with HTTP 402 Payment Required (got: ${failOrderRes.status})`
  );
  assert(
    failOrderRes.data?.code === "PAYMENT_REQUIRED" ||
      failOrderRes.data?.message?.toLowerCase().includes("insufficient"),
    `Error response indicates insufficient wallet balance: "${failOrderRes.data?.message}"`
  );

  // Check balance remains exactly 0
  const zeroBalCheck = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenZero}` },
  });
  const zeroBalance = Number(zeroBalCheck.data?.balance);
  assert(zeroBalance === 0, `Zero-balance user wallet remains untouched at ₹0.00 (got: ₹${zeroBalance})`);

  // ---------------------------------------------------------------------------
  // 2. FUNDED USER SETUP & DEPOSIT
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Funded User Setup & Deposit ---");

  const regFunded = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmailFunded, password: securePassword, name: "Funded User" }),
  });
  assert(regFunded.status === 201 || regFunded.status === 200, `Registered funded test user (status ${regFunded.status})`);
  const tokenFunded = regFunded.data?.token;

  // Deposit ₹1000
  const orderDep = await request("/payments/create-order", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify({ amount: 1000 }),
  });
  const gatewayOrderId = orderDep.data?.gatewayOrderId || orderDep.data?.id;
  assert(!!gatewayOrderId, `Created payment order for ₹1000: "${gatewayOrderId}"`);

  const compDep = await request("/payments/sandbox-complete", {
    method: "POST",
    body: JSON.stringify({ gatewayOrderId }),
  });
  assert(compDep.status === 200 || compDep.status === 201, `Completed sandbox payment deposit`);

  const initialBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const startingBalance = Number(initialBalRes.data?.balance);
  assert(startingBalance >= 1000, `Funded user starting balance verified (got: ₹${startingBalance})`);

  // ---------------------------------------------------------------------------
  // 3. ORDER PLACEMENT & IDEMPOTENCY (ORD-01, ORD-03)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Order Placement & Idempotency (ORD-01, ORD-03) ---");

  const idempotencyKey = `idemp_${ts}_${Math.random().toString(36).substring(2, 7)}`;
  const orderPayload = {
    serviceId: "1042",
    target: "https://instagram.com/p/ord01_test",
    quantity: 1000,
    idempotencyKey,
  };

  const createOrder1 = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify(orderPayload),
  });

  assert(
    createOrder1.status === 201 || createOrder1.status === 200,
    `Order placed successfully (status ${createOrder1.status})`
  );
  const order1 = createOrder1.data;
  assert(!!order1?.id, `Created order ID: ${order1?.id}`);
  assert(order1?.charge === 180, `Order charge calculated correctly at ₹180 for 1000 units (got: ₹${order1?.charge})`);
  assert(order1?.status === "PENDING", `Initial order status is PENDING (got: ${order1?.status})`);
  assert(order1?.remains === 1000, `Initial remaining count equals quantity (got: ${order1?.remains})`);

  // Balance deduction check
  const balAfterOrder1 = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const expectedBalance1 = startingBalance - 180;
  const actualBalance1 = Number(balAfterOrder1.data?.balance);
  assert(
    Math.abs(actualBalance1 - expectedBalance1) < 0.001,
    `Wallet atomically debited by ₹180 (expected ₹${expectedBalance1}, got ₹${actualBalance1})`
  );

  // Idempotency check 1: Exact replay returns identical order without extra debit
  const replayOrder1 = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify(orderPayload),
  });
  assert(
    replayOrder1.status === 201 || replayOrder1.status === 200,
    `Idempotent replay succeeds (status ${replayOrder1.status})`
  );
  assert(replayOrder1.data?.id === order1?.id, `Replay returned identical order ID (${replayOrder1.data?.id})`);

  const balAfterReplay = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(
    Number(balAfterReplay.data?.balance) === actualBalance1,
    `Idempotent replay caused no double debit (balance remains ₹${balAfterReplay.data?.balance})`
  );

  // Idempotency check 2: Same idempotency key with different parameters returns 409 Conflict
  const conflictOrder = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify({ ...orderPayload, quantity: 2000 }),
  });
  assert(
    conflictOrder.status === 409,
    `Reused idempotency key with different params rejected with 409 Conflict (got: ${conflictOrder.status})`
  );

  // ---------------------------------------------------------------------------
  // 4. ORDER TRACKING & DETAILS (ORD-04, ORD-08)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Order Tracking & Details (ORD-04, ORD-08) ---");

  // List orders
  const listOrdersRes = await request("/orders", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(listOrdersRes.status === 200, `GET /orders returns 200 OK (got ${listOrdersRes.status})`);
  assert(Array.isArray(listOrdersRes.data), `GET /orders returns an array`);
  const foundOrder = listOrdersRes.data?.find((o) => o.id === order1?.id);
  assert(!!foundOrder, `Created order found in user order list`);

  // Order details
  const getOrderRes = await request(`/orders/${order1?.id}`, {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(getOrderRes.status === 200, `GET /orders/:id returns 200 OK (got ${getOrderRes.status})`);
  assert(getOrderRes.data?.id === order1?.id, `Order ID matches requested ID`);
  assert(!!getOrderRes.data?.service?.name, `Order response includes service name: "${getOrderRes.data?.service?.name}"`);
  assert(Array.isArray(getOrderRes.data?.history), `Order response includes status history timeline`);

  // Unauthorized access guard: user zero should not be able to read user funded's order
  const forbiddenRes = await request(`/orders/${order1?.id}`, {
    headers: { Authorization: `Bearer ${tokenZero}` },
  });
  assert(
    forbiddenRes.status === 403 || forbiddenRes.status === 404,
    `Order data isolation preserved: cross-user read rejected with status ${forbiddenRes.status}`
  );

  // ---------------------------------------------------------------------------
  // 5. CANCELLATION & FULL REFUND (ORD-07)
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Order Cancellation & Full Refund (ORD-07) ---");

  // Place cancellable order (service 1043: rate 65, qty 1000 -> charge 65)
  const orderToCancelRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify({
      serviceId: "1043",
      target: "https://instagram.com/p/cancel_test",
      quantity: 1000,
    }),
  });
  const cancelOrderId = orderToCancelRes.data?.id;
  assert(!!cancelOrderId, `Placed order to be cancelled: ${cancelOrderId} (charge: ₹${orderToCancelRes.data?.charge})`);

  const balBeforeCancel = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });

  // Execute cancel
  const cancelRes = await request(`/orders/${cancelOrderId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(cancelRes.status === 200, `POST /orders/:id/cancel returns 200 OK (got ${cancelRes.status})`);
  assert(cancelRes.data?.success === true, `Cancel response confirmed success: "${cancelRes.data?.message}"`);

  const balAfterCancel = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const expectedRefundBal = Number(balBeforeCancel.data?.balance) + 65;
  const actualRefundBal = Number(balAfterCancel.data?.balance);
  assert(
    Math.abs(actualRefundBal - expectedRefundBal) < 0.001,
    `Full charge ₹65 credited back to wallet on cancellation (expected ₹${expectedRefundBal}, got ₹${actualRefundBal})`
  );

  // Check order status is now CANCELLED
  const cancelledOrderCheck = await request(`/orders/${cancelOrderId}`, {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(cancelledOrderCheck.data?.status === "CANCELLED", `Order status updated to CANCELLED`);

  // Re-cancellation rejected with 409 Conflict
  const reCancelRes = await request(`/orders/${cancelOrderId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(
    reCancelRes.status === 409 || reCancelRes.status === 400,
    `Re-cancellation of already cancelled order rejected (status ${reCancelRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 6. PROVIDER FAILURE DRILL & AUTO-REFUND (ORD-05)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Mock Provider Failure Drill & Auto-Refund (ORD-05) ---");

  const balBeforeFail = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const balBeforeFailNum = Number(balBeforeFail.data?.balance);

  // Place order for failure drill service srv_mock_fail (rate 200)
  const failDrillRes = await request("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFunded}` },
    body: JSON.stringify({
      serviceId: "srv_mock_fail",
      target: "https://x.com/post/fail_drill",
      quantity: 1000,
    }),
  });

  assert(failDrillRes.status === 201 || failDrillRes.status === 200, `Failure drill order placed`);
  const failOrder = failDrillRes.data;
  assert(failOrder?.status === "FAILED", `Provider failure drill correctly transitions order to FAILED`);

  // Verify wallet balance is fully restored via automatic refund
  const balAfterFail = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const balAfterFailNum = Number(balAfterFail.data?.balance);
  assert(
    Math.abs(balAfterFailNum - balBeforeFailNum) < 0.001,
    `Wallet balance restored after auto-refund (balance: ₹${balAfterFailNum})`
  );

  // ---------------------------------------------------------------------------
  // 7. FINANCIAL INVARIANT AUDIT (ORD-09)
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Financial Invariant Audit (ORD-09) ---");

  const ledgerRes = await request("/wallet/ledger", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  assert(ledgerRes.status === 200, `GET /wallet/ledger returns 200 OK`);
  const entries = ledgerRes.data || [];
  assert(Array.isArray(entries) && entries.length >= 4, `Ledger contains entries (count: ${entries.length})`);

  let computedLedgerBalance = 0;
  for (const entry of entries) {
    computedLedgerBalance += Number(entry.amount);
  }

  const finalBalRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenFunded}` },
  });
  const finalLiveBalance = Number(finalBalRes.data?.balance);

  console.log(`Live Wallet Balance: ₹${finalLiveBalance.toFixed(2)}`);
  console.log(`Sum of Ledger Entries: ₹${computedLedgerBalance.toFixed(2)}`);

  assert(
    Math.abs(finalLiveBalance - computedLedgerBalance) < 0.001,
    `Financial Invariant Preserved: Live Balance (₹${finalLiveBalance}) === Sum(Ledger) (₹${computedLedgerBalance})`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`Q3 VERIFICATION COMPLETE: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("================================================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runQ3().catch((err) => {
  console.error("FATAL ERROR running Q3 verification:", err);
  process.exit(1);
});
