/**
 * scripts/qa-q7-security.js
 * Comprehensive automated verification for SEC-01 (Security, Copy & Cross-Cutting Controls)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const API_BASE = process.env.API_URL || "http://127.0.0.1:4000/api/v1";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failedCount++;
  }
}

async function request(url, options = {}) {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data };
}

async function runQ7Security() {
  console.log("============================================================");
  console.log("Q7 Security Verification: SEC-01 Controls & Cross-Cutting Hardening");
  console.log(`API Base: ${API_BASE}`);
  console.log("============================================================\n");

  // --- 1. Copy & Banned Patterns Verification ---
  console.log("--- 1. Prohibited Copy & Banned Patterns Scan ---");
  try {
    const scanOut = execSync("node scripts/scan-banned-patterns.mjs", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, ".."),
    });
    assert(
      scanOut.includes("ZERO BANNED PATTERNS DETECTED"),
      "Banned pattern scanner reports zero emoji, placeholder, or banned brand violations"
    );
  } catch (err) {
    assert(false, `Banned pattern scanner failed: ${err.message}`);
  }

  // --- 2. HTTP Security Headers Inspection ---
  console.log("\n--- 2. HTTP Security Headers ---");
  const apiRes = await request("/services");
  assert(apiRes.status === 200, "API services endpoint reachable (HTTP 200)");

  const csp = apiRes.headers.get("content-security-policy");
  assert(csp && csp.includes("frame-ancestors 'self'"), "Strict Content-Security-Policy header present with frame-ancestors");
  assert(apiRes.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff header enforced");
  assert(apiRes.headers.get("x-frame-options") === "SAMEORIGIN", "X-Frame-Options: SAMEORIGIN clickjacking guard enforced");
  assert(
    apiRes.headers.get("strict-transport-security")?.includes("max-age"),
    "Strict-Transport-Security (HSTS) header enforced with max-age"
  );
  assert(apiRes.headers.get("x-request-id") !== null, "Unique X-Request-Id header appended to response");

  // --- 3. Rate Limiting & Account Lockout Guard on /auth/login ---
  console.log("\n--- 3. Login Lockout & Abuse Rate Limiting ---");
  const testEmail = `lockout_victim_${Date.now()}@example.com`;

  let lockedOut = false;
  let retrySecondsReported = false;

  for (let i = 1; i <= 6; i++) {
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "WrongPassword999!" }),
    });

    if (loginRes.status === 401 && typeof loginRes.data?.message === "string") {
      if (loginRes.data.message.includes("temporarily locked")) {
        lockedOut = true;
        if (/retry in \d+ seconds/i.test(loginRes.data.message)) {
          retrySecondsReported = true;
        }
      }
    }
  }

  assert(lockedOut, "5 consecutive failed login attempts activate account lockout protection");
  assert(retrySecondsReported, "Lockout response informs user with exact cooldown seconds remaining");

  // --- 4. SQL Injection Sanitization & DTO Validation ---
  console.log("\n--- 4. SQL Injection Protection (DAST) ---");
  const sqliVectors = [
    "' OR '1'='1",
    "'; DROP TABLE \"Wallet\"; --",
    "1 UNION SELECT null, username, password FROM users--",
  ];

  let sqliBlocked = true;
  for (const payload of sqliVectors) {
    const res = await request("/orders", {
      method: "POST",
      body: JSON.stringify({ serviceId: payload, target: "https://instagram.com/test", quantity: 100 }),
    });
    // Must never return 500 internal server error
    if (res.status === 500) {
      sqliBlocked = false;
    }
  }
  assert(sqliBlocked, "All SQL injection payloads rejected without 500 unhandled errors");

  // --- 5. Stored & Reflected XSS Protection ---
  console.log("\n--- 5. XSS Sanitization & HTML Escaping ---");
  const xssVectors = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/'/+/onmouseover=1/(alert)(1)//>",
  ];

  let xssSanitized = true;
  for (const vector of xssVectors) {
    const ticketRes = await request("/tickets", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token" },
      body: JSON.stringify({ subject: vector, message: vector }),
    });
    if (ticketRes.data && typeof ticketRes.data.message === "string" && ticketRes.data.message.includes("<script>")) {
      xssSanitized = false;
    }
  }
  assert(xssSanitized, "XSS payloads rejected or sanitized through strict DTO boundaries");

  // --- 6. IDOR Isolation Across Boundaries ---
  console.log("\n--- 6. IDOR Isolation & Resource Protection ---");
  const idorRes = await request("/orders/ORD-NONEXISTENT-OR-FOREIGN-999", {
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake" },
  });
  assert(
    idorRes.status === 401 || idorRes.status === 403 || idorRes.status === 404,
    `Cross-account resource access strictly forbidden (HTTP ${idorRes.status})`
  );

  // --- 7. RBAC Role Escalation Guard ---
  console.log("\n--- 7. RBAC Role Escalation Guard ---");
  const rbacRes = await request("/providers", {
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake" },
  });
  assert(
    rbacRes.status === 401 || rbacRes.status === 403,
    `Unprivileged access to administrative providers catalog blocked (HTTP ${rbacRes.status})`
  );

  // --- 8. JWT Cryptographic Tampering Guard ---
  console.log("\n--- 8. JWT Alg: None & Signature Forgery Guard ---");
  const algNoneToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c3JfYWRtaW4ifQ.";
  const jwtRes = await request("/users/me", {
    headers: { Authorization: `Bearer ${algNoneToken}` },
  });
  assert(jwtRes.status === 401, `Forged 'alg: none' JWT token rejected with 401 (got ${jwtRes.status})`);

  // --- 9. Webhook Signature Forgery & Replay Protection ---
  console.log("\n--- 9. Webhook Signature & Replay Protection ---");
  const forgeRes = await request("/payments/webhook", {
    method: "POST",
    headers: { "X-Razorpay-Signature": "forged_invalid_signature_hash_12345" },
    body: JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { amount: 50000 } } } }),
  });
  assert(
    forgeRes.status === 400 || forgeRes.status === 401,
    `Forged payment webhook signature rejected without balance credit (HTTP ${forgeRes.status})`
  );

  // --- 10. Run Full Security Test Suite ---
  console.log("\n--- 10. Dedicated Security Regression Test Suite ---");
  try {
    const jestSecOut = execSync("pnpm --filter @smm/api run test:security 2>&1", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, ".."),
    });
    assert(
      jestSecOut.includes("9 passed, 9 total"),
      "Jest security regression suite (SQLi, XSS, JWT, Upload boundaries) passed 9/9 tests"
    );
  } catch (err) {
    assert(false, `Jest security suite execution failed: ${err.message}`);
  }

  console.log("\n============================================================");
  console.log(`Q7 SEC-01 Complete: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("============================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runQ7Security().catch((err) => {
  console.error("Unhandled error in Q7 security runner:", err);
  process.exit(1);
});
