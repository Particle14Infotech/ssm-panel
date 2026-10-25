/**
 * Q2 Catalog & Wallet Functional Verification Suite
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

async function runQ2() {
  console.log("================================================================================");
  console.log("▶ STARTING Q2: CATALOG AND WALLET VERIFICATION SUITE");
  console.log(`API Base: ${API_BASE}`);
  console.log("================================================================================\n");

  const ts = Date.now();
  const testEmail = `qa_wallet_${ts}@smm.dev`;
  const securePassword = "Password123!Secure";

  // ---------------------------------------------------------------------------
  // 1. SERVICES CATALOG (CAT-01)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Services Catalog Verification ---");

  // 1a. List all active services
  const servicesRes = await request("/services");
  assert(servicesRes.status === 200, `GET /services returns 200 OK (got ${servicesRes.status})`);
  assert(Array.isArray(servicesRes.data), `GET /services returns an array of services (length: ${servicesRes.data?.length})`);

  if (Array.isArray(servicesRes.data) && servicesRes.data.length > 0) {
    const s = servicesRes.data[0];
    assert(typeof s.name === "string" && s.name.length > 0, `Service has valid name: "${s.name}"`);
    assert(typeof s.rate === "number" || typeof s.rate === "string", `Service has valid rate (rate: ${s.rate})`);
    assert(typeof s.min === "number" && s.min > 0, `Service has valid min quantity (min: ${s.min})`);
    assert(typeof s.max === "number" && s.max >= s.min, `Service max >= min (max: ${s.max})`);
    assert(typeof s.platform === "string", `Service has valid platform: "${s.platform}"`);
  }

  // 1b. Grouped catalog
  const groupedRes = await request("/services/grouped");
  assert(groupedRes.status === 200, `GET /services/grouped returns 200 OK (got ${groupedRes.status})`);
  assert(
    typeof groupedRes.data === "object" && groupedRes.data !== null,
    `Grouped catalog returns structured object/array`
  );

  // 1c. Categories
  const categoriesRes = await request("/services/categories");
  assert(categoriesRes.status === 200, `GET /services/categories returns 200 OK (got ${categoriesRes.status})`);
  assert(Array.isArray(categoriesRes.data), `Categories returns an array (count: ${categoriesRes.data?.length})`);

  // 1d. Platforms
  const platformsRes = await request("/services/platforms");
  assert(platformsRes.status === 200, `GET /services/platforms returns 200 OK (got ${platformsRes.status})`);
  assert(Array.isArray(platformsRes.data), `Platforms returns an array`);

  // ---------------------------------------------------------------------------
  // 2. WALLET ZERO-STATE & LEDGER (WAL-01, WAL-03)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Wallet Zero-State & Ledger Verification ---");

  // Register new customer
  const regRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmail, password: securePassword, name: "Wallet Test User" }),
  });
  assert(regRes.status === 201 || regRes.status === 200, `Registered test user for wallet checks (status ${regRes.status})`);
  const token = regRes.data?.token;
  assert(!!token, `Received JWT token on registration for wallet operations`);

  // Initial balance
  const balanceRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(balanceRes.status === 200, `GET /wallet/balance returns 200 OK (got ${balanceRes.status})`);
  const initialBalance = Number(balanceRes.data?.balance);
  assert(initialBalance === 0, `Initial wallet balance is exactly 0.00 INR (got: ${initialBalance})`);
  assert(!Number.isNaN(initialBalance), `Initial wallet balance is not NaN`);
  assert(balanceRes.data?.currency === "INR", `Wallet currency is INR (got: "${balanceRes.data?.currency}")`);

  // Initial ledger
  const ledgerRes = await request("/wallet/ledger", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(ledgerRes.status === 200, `GET /wallet/ledger returns 200 OK (got ${ledgerRes.status})`);
  assert(Array.isArray(ledgerRes.data), `GET /wallet/ledger returns an array (length: ${ledgerRes.data?.length})`);

  // ---------------------------------------------------------------------------
  // 3. SANDBOX ADD FUNDS & WEBHOOK VERIFICATION (WAL-02, WAL-03)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Add Funds & Payment Simulation ---");

  const depositAmount = 500;
  const createOrderRes = await request("/payments/create-order", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount: depositAmount }),
  });
  assert(
    createOrderRes.status === 200 || createOrderRes.status === 201,
    `POST /payments/create-order succeeds (status ${createOrderRes.status})`
  );
  const gatewayOrderId = createOrderRes.data?.gatewayOrderId || createOrderRes.data?.id;
  assert(!!gatewayOrderId, `Generated gatewayOrderId: "${gatewayOrderId}"`);

  // Complete deposit via sandbox endpoint
  const completeRes = await request("/payments/sandbox-complete", {
    method: "POST",
    body: JSON.stringify({ gatewayOrderId }),
  });
  assert(
    completeRes.status === 200 || completeRes.status === 201,
    `POST /payments/sandbox-complete returns success (status ${completeRes.status})`
  );

  // Check updated balance
  const updatedBalanceRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const updatedBalance = Number(updatedBalanceRes.data?.balance);
  assert(
    updatedBalance >= depositAmount,
    `Wallet balance credited (expected >= ${depositAmount}, got: ${updatedBalance})`
  );

  // Idempotency check: Replay complete call
  const replayCompleteRes = await request("/payments/sandbox-complete", {
    method: "POST",
    body: JSON.stringify({ gatewayOrderId }),
  });
  assert(
    replayCompleteRes.status === 200 || replayCompleteRes.status === 201 || replayCompleteRes.status === 400 || replayCompleteRes.status === 409,
    `Replaying completion handled gracefully (status ${replayCompleteRes.status})`
  );

  const afterReplayBalanceRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterReplayBalance = Number(afterReplayBalanceRes.data?.balance);
  assert(
    afterReplayBalance === updatedBalance,
    `Idempotency preserved: Balance not double-credited (balance: ${afterReplayBalance})`
  );

  // Ledger entry check
  const updatedLedgerRes = await request("/wallet/ledger", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(
    Array.isArray(updatedLedgerRes.data) && updatedLedgerRes.data.length > 0,
    `Ledger contains at least one transaction record (count: ${updatedLedgerRes.data?.length})`
  );

  // Invariant: Balance equals sum of ledger entries
  let calculatedLedgerSum = 0;
  for (const entry of updatedLedgerRes.data || []) {
    const amt = Number(entry.amount || 0);
    if (entry.type === "DEPOSIT" || entry.type === "CREDIT" || entry.type === "REFUND") {
      calculatedLedgerSum += Math.abs(amt);
    } else if (entry.type === "CHARGE" || entry.type === "ORDER" || entry.type === "DEBIT") {
      calculatedLedgerSum -= Math.abs(amt);
    } else {
      calculatedLedgerSum += amt;
    }
  }
  assert(
    Math.abs(updatedBalance - calculatedLedgerSum) < 0.01,
    `Financial Invariant: Live balance (${updatedBalance}) matches ledger sum (${calculatedLedgerSum})`
  );

  console.log("\n================================================================================");
  console.log(`Q2 CATALOG & WALLET RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log("================================================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runQ2().catch((err) => {
  console.error("FATAL ERROR in Q2 suite:", err);
  process.exit(1);
});
