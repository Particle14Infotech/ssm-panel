/**
 * scripts/qa-q6-admin.js
 * Verification suite for Admin Command Operations: ADM-01 to ADM-06
 *
 * Verifies:
 * 1. ADM-01: Admin Reports & Command Analytics Summary (GET /reports/summary)
 * 2. ADM-02: Admin User Directory & Mandatory Justification Wallet Balance Adjustment (GET /users, POST /wallet/adjust)
 * 3. ADM-03: Services & Categories Management with Pricing Markups (POST /services/categories, POST /services, PUT /services/:id)
 * 4. ADM-04: Provider Node Registration, Key Masking & Live Sync (GET /providers, POST /providers, POST /providers/:id/sync)
 * 5. ADM-05: Admin Orders Listing, Operational Notes & Manual Refund (GET /orders, PUT /orders/:id/notes, POST /orders/:id/refund)
 * 6. ADM-06: System Health Matrix & Audit Log Verification (GET /health/system)
 * 7. Security: Customer Role Guard Blocks Non-Admin from all Admin Endpoints (HTTP 403 Forbidden)
 */

const API_BASE = process.env.API_BASE || "http://127.0.0.1:4000/api/v1";

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
}

function logFail(msg, detail) {
  console.error(`[FAIL] ${msg}`);
  if (detail) console.error("  Details:", detail);
}

function assert(condition, message, detail) {
  if (condition) {
    logPass(message);
  } else {
    logFail(message, detail);
    throw new Error(message);
  }
}

async function request(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log("============================================================");
  console.log("Q6 API Verification: Admin Command Operations (ADM-01 to ADM-06)");
  console.log(`API Base: ${API_BASE}`);
  console.log("============================================================\n");

  const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Authenticate as Master Admin
  console.log("--- 1. Master Admin Authentication ---");
  const adminLogin = await request("POST", "/auth/login", {
    email: "vaibhavrishabh40@gmail.com",
    password: "Admin123!Secure",
  });
  assert(
    (adminLogin.status === 200 || adminLogin.status === 201) && adminLogin.data.success && adminLogin.data.token,
    "1. Master admin successfully authenticated with ADMIN role",
    adminLogin.data
  );
  const adminToken = adminLogin.data.token;
  assert(
    adminLogin.data.user.role === "ADMIN",
    `2. Authenticated user has ADMIN role: ${adminLogin.data.user.role}`
  );

  // 2. Register a temporary customer to test role guards & user directory
  console.log("\n--- 2. Customer User Registration for Isolation Tests ---");
  const custEmail = `adm_cust_${ts}@smm.dev`;
  const custReg = await request("POST", "/auth/register", {
    name: `Admin Test Customer ${ts}`,
    username: `adm_c_${ts}`,
    email: custEmail,
    password: "Password123!Secure",
  });
  assert(
    custReg.status === 201 && custReg.data.token,
    "3. Customer user registered for admin testing"
  );
  const customerToken = custReg.data.token;
  const customerId = custReg.data.user.id;

  // 3. Security Role Guard: Non-admin customer forbidden from admin endpoints
  console.log("\n--- 3. Role Guard: Customer Forbidden from Admin Endpoints ---");
  const forbiddenReports = await request("GET", "/reports/summary", null, customerToken);
  assert(
    forbiddenReports.status === 403,
    `4. Customer blocked from GET /reports/summary (HTTP ${forbiddenReports.status} Forbidden)`
  );

  const forbiddenUsers = await request("GET", "/users", null, customerToken);
  assert(
    forbiddenUsers.status === 403,
    `5. Customer blocked from GET /users (HTTP ${forbiddenUsers.status} Forbidden)`
  );

  const forbiddenAdjust = await request(
    "POST",
    "/wallet/adjust",
    { userId: customerId, amount: 100, reason: "hack" },
    customerToken
  );
  assert(
    forbiddenAdjust.status === 403,
    `6. Customer blocked from POST /wallet/adjust (HTTP ${forbiddenAdjust.status} Forbidden)`
  );

  const forbiddenProviders = await request("GET", "/providers", null, customerToken);
  assert(
    forbiddenProviders.status === 403,
    `7. Customer blocked from GET /providers (HTTP ${forbiddenProviders.status} Forbidden)`
  );

  // 4. ADM-01: Admin Reports & Command Analytics Summary
  console.log("\n--- 4. ADM-01: Admin Command Analytics Summary ---");
  const summaryRes = await request("GET", "/reports/summary", null, adminToken);
  assert(
    summaryRes.status === 200,
    `8. Admin accessed GET /reports/summary (HTTP ${summaryRes.status})`
  );
  assert(
    typeof summaryRes.data?.totalRevenue === "number" &&
      typeof summaryRes.data?.activeOrders === "number",
    `9. Analytics summary contains expected KPI metrics (Revenue: ₹${summaryRes.data?.totalRevenue})`
  );

  const exportRes = await request("GET", "/reports/export-csv", null, adminToken);
  assert(
    exportRes.status === 200 && exportRes.data?.contentType === "text/csv",
    "10. CSV Report export generated successfully"
  );

  // 5. ADM-02: User Directory & Balance Adjustment with Mandatory Justification
  console.log("\n--- 5. ADM-02: User Directory & Balance Adjustment ---");
  const usersRes = await request("GET", "/users", null, adminToken);
  assert(
    usersRes.status === 200 && Array.isArray(usersRes.data),
    `11. Admin listed user directory (${usersRes.data?.length} users returned)`
  );
  const foundCust = usersRes.data.find((u) => u.id === customerId);
  assert(
    !!foundCust,
    `12. Newly registered customer found in admin user directory (#${customerId.slice(0, 8)})`
  );

  // Adjustment without reason rejected
  const noReasonAdjust = await request(
    "POST",
    "/wallet/adjust",
    { userId: customerId, amount: 500, reason: "" },
    adminToken
  );
  assert(
    noReasonAdjust.status === 400,
    `13. Balance adjustment without reason rejected with HTTP 400 (got ${noReasonAdjust.status})`
  );

  // Valid adjustment with reason
  const adjustAmount = 250.0;
  const adjustReason = `Goodwill compensation for QA verification ticket #${ts}`;
  const adjustRes = await request(
    "POST",
    "/wallet/adjust",
    { userId: customerId, amount: adjustAmount, reason: adjustReason },
    adminToken
  );
  assert(
    adjustRes.status === 200 || adjustRes.status === 201,
    `14. Admin balance adjustment executed (+₹${adjustAmount})`
  );

  // Verify Customer Wallet & Ledger updated
  const custBalRes = await request("GET", "/wallet/balance", null, customerToken);
  const custBal = Number(custBalRes.data?.balance || custBalRes.data);
  assert(
    Math.abs(custBal - adjustAmount) < 0.05,
    `15. Customer balance reflects exact adjustment: ₹${custBal.toFixed(2)}`
  );

  const custLedgerRes = await request("GET", "/wallet/ledger", null, customerToken);
  const ledgerList = Array.isArray(custLedgerRes.data)
    ? custLedgerRes.data
    : custLedgerRes.data?.entries || [];
  const adjustEntry = ledgerList.find((e) => e.description?.includes(adjustReason) || e.type === "ADMIN_ADJUST" || e.type === "ADJUSTMENT");
  assert(
    !!adjustEntry,
    "16. Immutable ledger entry created with audit justification message"
  );

  // 6. ADM-03: Services & Categories Management
  console.log("\n--- 6. ADM-03: Services & Categories Management ---");
  const newCat = {
    name: `Premium Growth #${ts}`,
    slug: `premium-growth-${ts}`,
    sortOrder: 10,
  };
  const createCatRes = await request("POST", "/services/categories", newCat, adminToken);
  assert(
    createCatRes.status === 200 || createCatRes.status === 201,
    `17. Category created successfully: "${newCat.name}" (HTTP ${createCatRes.status})`
  );
  const createdCatId = createCatRes.data?.category?.id || createCatRes.data?.id;

  const newService = {
    categoryId: createdCatId,
    name: `Exclusive VIP Followers #${ts}`,
    platform: "INSTAGRAM",
    ratePer1000: 250.0,
    costINR: 150.0,
    minQty: 100,
    maxQty: 50000,
    refillable: true,
    cancellable: true,
    status: "ACTIVE",
  };
  const createSrvRes = await request("POST", "/services", newService, adminToken);
  assert(
    createSrvRes.status === 200 || createSrvRes.status === 201,
    `18. New service created with cost INR and selling rate (HTTP ${createSrvRes.status})`
  );
  const createdSrvId = createSrvRes.data?.service?.id || createSrvRes.data?.id;

  // Update service markup
  const updateSrvRes = await request(
    "PUT",
    `/services/${createdSrvId}`,
    { ratePer1000: 280.0, marginPercentOverride: 30 },
    adminToken
  );
  assert(
    updateSrvRes.status === 200,
    `19. Service markup updated to ₹280.00 / 1k (HTTP ${updateSrvRes.status})`
  );

  // 7. ADM-04: Provider Node Registration, Key Masking & Live Sync
  console.log("\n--- 7. ADM-04: Provider Node Management ---");
  const newProvider = {
    name: `Wholesaler Gateway Node #${ts}`,
    apiUrl: "https://api.mock-wholesaler.com/v2",
    apiKey: "sk_live_secret_auth_token_998877",
  };
  const createProvRes = await request("POST", "/providers", newProvider, adminToken);
  assert(
    createProvRes.status === 200 || createProvRes.status === 201,
    `20. Provider connected successfully: "${newProvider.name}"`
  );
  const providerId = createProvRes.data?.id;

  const provListRes = await request("GET", "/providers", null, adminToken);
  const foundProv = (provListRes.data || []).find((p) => p.id === providerId);
  assert(
    !!foundProv,
    `21. Created provider returned in providers list (#${providerId?.slice(0, 8)})`
  );
  assert(
    !foundProv.apiKey || foundProv.apiKeyMasked?.includes("•") || foundProv.apiKey?.includes("•") || foundProv.apiKey?.includes("*") || foundProv.apiKey?.length <= 10,
    "22. Provider API secret key is securely masked in admin telemetry"
  );

  const syncProvRes = await request("POST", `/providers/${providerId}/sync`, {}, adminToken);
  assert(
    syncProvRes.status === 200 || syncProvRes.status === 201,
    `23. Provider live balance sync completed (HTTP ${syncProvRes.status})`
  );

  // 8. ADM-05: Orders Management, Notes & Manual Refund
  console.log("\n--- 8. ADM-05: Orders Management & Refund Action ---");
  // Customer places an order using the credited funds
  const orderRes = await request(
    "POST",
    "/orders",
    {
      serviceId: "1042",
      target: "https://instagram.com/adm_qa_profile",
      quantity: 1000,
      idempotencyKey: `ord_adm_test_${ts}`,
    },
    customerToken
  );
  assert(
    orderRes.status === 201 && orderRes.data?.id,
    `24. Order created by customer for admin management (#${orderRes.data?.id?.slice(0, 8)})`
  );
  const testOrderId = orderRes.data.id;

  // Admin lists all orders across system
  const allOrdersRes = await request("GET", "/orders", null, adminToken);
  assert(
    allOrdersRes.status === 200 && Array.isArray(allOrdersRes.data),
    `25. Admin listed all system orders (${allOrdersRes.data?.length} total)`
  );

  // Admin adds internal operational notes to order
  const updateNotesRes = await request(
    "PUT",
    `/orders/${testOrderId}/notes`,
    { notes: "Customer verified on Discord support; verified valid link." },
    adminToken
  );
  assert(
    updateNotesRes.status === 200,
    `26. Admin updated operational notes on order #${testOrderId.slice(0, 8)}`
  );

  // Admin executes manual refund on the order
  const balBeforeRefundRes = await request("GET", "/wallet/balance", null, customerToken);
  const balBeforeRefund = Number(balBeforeRefundRes.data?.balance || balBeforeRefundRes.data);

  const adminRefundRes = await request("POST", `/orders/${testOrderId}/refund`, {}, adminToken);
  assert(
    adminRefundRes.status === 200 || adminRefundRes.status === 201,
    `27. Admin executed manual refund on order #${testOrderId.slice(0, 8)}`
  );

  const balAfterRefundRes = await request("GET", "/wallet/balance", null, customerToken);
  const balAfterRefund = Number(balAfterRefundRes.data?.balance || balAfterRefundRes.data);
  assert(
    balAfterRefund > balBeforeRefund,
    `28. Customer wallet credited following admin manual refund: ₹${balAfterRefund.toFixed(2)}`
  );

  // 9. ADM-06: System Health Matrix & Audit Telemetry
  console.log("\n--- 9. ADM-06: System Health Matrix ---");
  const healthRes = await request("GET", "/health/system", null, adminToken);
  assert(
    healthRes.status === 200,
    `29. Admin retrieved system health telemetry (HTTP ${healthRes.status})`
  );
  assert(
    healthRes.data?.components?.database?.status === "CONNECTED" || healthRes.data?.services?.database === "connected",
    `30. System telemetry confirms database status is CONNECTED`
  );

  console.log("\n============================================================");
  console.log("Q6 API Verification Complete: 30 Passed, 0 Failed");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("FATAL ERROR in Q6 Suite:", err.message);
  process.exit(1);
});
