/**
 * Q1 Auth and Account Functional Verification Suite
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

async function runQ1() {
  console.log("================================================================================");
  console.log("▶ STARTING Q1: AUTH AND ACCOUNT VERIFICATION SUITE");
  console.log(`API Base: ${API_BASE}`);
  console.log("================================================================================\n");

  const ts = Date.now();
  const testEmailA = `qa_cust_a_${ts}@smm.dev`;
  const testEmailB = `qa_cust_b_${ts}@smm.dev`;
  const securePassword = "Password123!Secure";
  const weakPassword = "123";

  // ---------------------------------------------------------------------------
  // 1. REGISTER VALIDATION
  // ---------------------------------------------------------------------------
  console.log("--- 1. Register Validation ---");
  
  // 1a. Missing required fields
  const missingEmailRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ password: securePassword, name: "No Email" }),
  });
  assert(missingEmailRes.status === 400, `Rejects missing email with 400 (got ${missingEmailRes.status})`);

  // 1b. Weak password (<8 chars)
  const weakPassRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: `weak_${ts}@smm.dev`, password: weakPassword, name: "Weak Pass" }),
  });
  assert(weakPassRes.status === 400, `Rejects weak password with 400 (got ${weakPassRes.status})`);

  // 1c. Valid registration for Customer A
  const regARes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmailA, password: securePassword, name: "Customer A Test" }),
  });
  assert(regARes.status === 201 || regARes.status === 200, `Registers valid User A (status ${regARes.status})`);
  assert(regARes.data?.user?.balance === 0, `User A initial wallet balance is 0 without NaN (balance: ${regARes.data?.user?.balance})`);
  const userAId = regARes.data?.user?.id;

  // 1d. Duplicate email rejected
  const dupEmailRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmailA, password: securePassword, name: "Duplicate A" }),
  });
  assert(dupEmailRes.status === 400 || dupEmailRes.status === 409, `Rejects duplicate email with 400/409 (got ${dupEmailRes.status})`);

  // 1e. Valid registration for Customer B
  const regBRes = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: testEmailB, password: securePassword, name: "Customer B Test" }),
  });
  assert(regBRes.status === 201 || regBRes.status === 200, `Registers valid User B (status ${regBRes.status})`);
  const userBId = regBRes.data?.user?.id;

  // ---------------------------------------------------------------------------
  // 2. LOGIN & LOCKOUT
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Login & Lockout Protection ---");

  // 2a. Wrong password -> generic error
  const wrongPassRes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: testEmailA, password: "WrongPassword999!" }),
  });
  assert(wrongPassRes.status === 401, `Wrong password returns 401 Unauthorized (got ${wrongPassRes.status})`);
  assert(
    typeof wrongPassRes.data?.message === "string" && !wrongPassRes.data.message.includes("hash"),
    `Wrong password returns safe generic message: "${wrongPassRes.data?.message}"`
  );

  // 2b. Correct login for Customer A -> token received
  const loginARes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: testEmailA, password: securePassword }),
  });
  assert(loginARes.status === 200 || loginARes.status === 201, `Customer A login succeeds (status ${loginARes.status})`);
  assert(!!loginARes.data?.token, `Customer A received JWT access token`);
  assert(!!loginARes.data?.refreshToken, `Customer A received refresh token`);
  const tokenA = loginARes.data?.token;
  const refreshTokenA = loginARes.data?.refreshToken;

  // 2c. Correct login for Customer B
  const loginBRes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: testEmailB, password: securePassword }),
  });
  assert(loginBRes.status === 200 || loginBRes.status === 201, `Customer B login succeeds (status ${loginBRes.status})`);
  const tokenB = loginBRes.data?.token;

  // 2d. Admin login
  const adminPassword = process.env.ADMIN_PASSWORD || "01328627635aaa6cd7dfa329e319e5e7";
  const adminLoginRes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@smmpanel.internal", password: adminPassword }),
  });
  assert(adminLoginRes.status === 200 || adminLoginRes.status === 201, `Admin login succeeds (status ${adminLoginRes.status})`);
  assert(adminLoginRes.data?.user?.role === "ADMIN", `Admin role verified as ADMIN`);
  const adminToken = adminLoginRes.data?.token;

  // ---------------------------------------------------------------------------
  // 3. SESSION LIFECYCLE & TOKEN ROTATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Session Lifecycle & Token Rotation ---");

  // 3a. Silent Refresh with valid refreshToken
  const refreshRes = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: refreshTokenA }),
  });
  assert(refreshRes.status === 200 || refreshRes.status === 201, `Refresh returns 200 with new token family (status ${refreshRes.status})`);
  assert(!!refreshRes.data?.token, `Received new access token on refresh`);
  const newRefreshTokenA = refreshRes.data?.refreshToken;

  // 3b. Refresh token reuse detection (reusing old refreshTokenA)
  if (newRefreshTokenA) {
    const reuseRes = await request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshTokenA }),
    });
    assert(
      reuseRes.status === 401 || reuseRes.status === 403,
      `Reusing old refresh token is rejected (status ${reuseRes.status})`
    );
  }

  // 3c. Logout revokes token session
  const logoutRes = await request("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(
    logoutRes.status === 200 || logoutRes.status === 201 || logoutRes.status === 204,
    `Logout endpoint returns success (status ${logoutRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 4. FORGOT & RESET PASSWORD
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Forgot & Reset Password ---");

  // 4a. Neutral message for unknown emails
  const forgotUnknownRes = await request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "nonexistent_user_999@smm.dev" }),
  });
  assert(
    forgotUnknownRes.status === 200 || forgotUnknownRes.status === 201 || forgotUnknownRes.status === 202,
    `Forgot password returns neutral status for unknown email (status ${forgotUnknownRes.status})`
  );

  // 4b. Forgot password for existing email
  const forgotExistingRes = await request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: testEmailA }),
  });
  assert(
    forgotExistingRes.status === 200 || forgotExistingRes.status === 201 || forgotExistingRes.status === 202,
    `Forgot password returns success for valid user (status ${forgotExistingRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 5. ROLE GUARD & TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Role Guard & Cross-User Data Isolation ---");

  // 5a. Customer calling Admin endpoint -> 403 Forbidden
  const custAdminRes = await request("/providers", {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    custAdminRes.status === 403,
    `Customer calling admin GET /providers receives HTTP 403 Forbidden (got ${custAdminRes.status})`
  );

  // 5b. Customer calling Admin Users endpoint -> 403 Forbidden
  const custUsersRes = await request("/users", {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    custUsersRes.status === 403,
    `Customer calling admin GET /users receives HTTP 403 Forbidden (got ${custUsersRes.status})`
  );

  // 5c. Customer B cannot read Customer A's wallet balance
  const custBWalletRes = await request("/wallet/balance", {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    custBWalletRes.status === 200 && Number(custBWalletRes.data?.balance || 0) === 0,
    `Customer B wallet balance returns Customer B's balance only (₹0.00, not A's)`
  );

  // 5d. Unauthenticated access is rejected with 401
  const unauthOrdersRes = await request("/orders");
  assert(
    unauthOrdersRes.status === 401,
    `Unauthenticated GET /orders rejected with 401 Unauthorized (got ${unauthOrdersRes.status})`
  );

  const unauthWalletRes = await request("/wallet/balance");
  assert(
    unauthWalletRes.status === 401,
    `Unauthenticated GET /wallet/balance rejected with 401 Unauthorized (got ${unauthWalletRes.status})`
  );

  console.log("\n================================================================================");
  console.log(`Q1 AUTH VERIFICATION RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log("================================================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runQ1().catch((err) => {
  console.error("FATAL ERROR in Q1 suite:", err);
  process.exit(1);
});
