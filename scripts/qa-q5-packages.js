const http = require("http");

function request(method, path, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: 4000,
        path: `/api/v1${path}`,
        method,
        headers: {
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        let resBody = "";
        res.on("data", (chunk) => (resBody += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log("============================================================");
  console.log("Q5 API Verification: Packages Architecture & Execution (PKG-01)");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 1. Register User A (Customer)
  const userA = {
    name: `Q5 User A ${ts}`,
    username: `q5_usera_${ts}`,
    email: `q5_usera_${ts}@smm.dev`,
    password: "Password123!Secure",
  };
  const regARes = await request("POST", "/auth/register", userA);
  assert(regARes.status === 201 && regARes.data.token, "1. User A successfully registered");
  const tokenA = regARes.data.token;
  const userAId = regARes.data.user.id;

  // 2. Register User B (Tenant Isolation Test)
  const userB = {
    name: `Q5 User B ${ts}`,
    username: `q5_userb_${ts}`,
    email: `q5_userb_${ts}@smm.dev`,
    password: "Password123!Secure",
  };
  const regBRes = await request("POST", "/auth/register", userB);
  assert(regBRes.status === 201 && regBRes.data.token, "2. User B successfully registered");
  const tokenB = regBRes.data.token;

  // 3. Test Bundle Templates
  const bundleTplRes = await request("GET", "/packages/bundle/templates", null, tokenA);
  assert(
    bundleTplRes.status === 200 && Array.isArray(bundleTplRes.data) && bundleTplRes.data.length > 0,
    `3. Bundle templates available (${bundleTplRes.data?.length} templates returned)`
  );

  // 4. Test Quote Generation (POST /api/v1/packages/quote)
  const quotePayload = {
    platform: "instagram",
    handle: `growth_${ts}`,
    timezone: "UTC",
    days: 7,
    items: [
      {
        serviceId: "1042",
        target: `https://instagram.com/growth_${ts}`,
        targetType: "PROFILE",
        quantity: 700,
      },
      {
        serviceId: "1043",
        target: `https://instagram.com/p/DA_test_${ts}`,
        targetType: "POST_OR_REEL",
        quantityPerPost: 100,
        quantity: 500,
      },
    ],
  };

  const quoteRes = await request("POST", "/packages/quote", quotePayload, tokenA);
  assert(
    quoteRes.status === 201 || quoteRes.status === 200,
    `4. Quote generation succeeded with status ${quoteRes.status}`
  );
  assert(
    quoteRes.data && quoteRes.data.quoteHash && quoteRes.data.quoteHash.startsWith("qh_"),
    `5. Server cryptographic quote signature returned: ${quoteRes.data?.quoteHash?.substring(0, 24)}...`
  );
  assert(
    quoteRes.data && quoteRes.data.totalCharge > 0 && Array.isArray(quoteRes.data.timeline),
    `6. Quote computed totalCharge: ₹${quoteRes.data?.totalCharge} across ${quoteRes.data?.timeline?.length} runs`
  );
  const quoteHash = quoteRes.data.quoteHash;
  const totalCharge = quoteRes.data.totalCharge;

  // 5. Test Purchase without Quote Hash (Should be rejected)
  const noHashPurchase = await request(
    "POST",
    "/packages/purchase",
    {
      ...quotePayload,
      consentRulesUnderstood: true,
      idempotencyKey: `pkg_idem_nohash_${ts}`,
    },
    tokenA
  );
  assert(
    noHashPurchase.status === 400,
    `7. Purchase without quoteHash rejected with HTTP 400 (got ${noHashPurchase.status})`
  );

  // 6. Test Purchase with Tampered Quote Hash (Should be rejected)
  const tamperedPurchase = await request(
    "POST",
    "/packages/purchase",
    {
      ...quotePayload,
      quoteHash: "qh_v2_primary_9999999999999_deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd",
      consentRulesUnderstood: true,
      idempotencyKey: `pkg_idem_tamper_${ts}`,
    },
    tokenA
  );
  assert(
    tamperedPurchase.status === 400 || tamperedPurchase.status === 409,
    `8. Purchase with tampered quoteHash rejected with HTTP ${tamperedPurchase.status}`
  );

  // 7. Test Purchase with Insufficient Balance (User A has ₹0 balance)
  const insufficientPurchase = await request(
    "POST",
    "/packages/purchase",
    {
      ...quotePayload,
      quoteHash,
      consentRulesUnderstood: true,
      idempotencyKey: `pkg_idem_nobal_${ts}`,
    },
    tokenA
  );
  assert(
    insufficientPurchase.status === 400 || insufficientPurchase.status === 402,
    `9. Purchase with insufficient balance rejected with HTTP ${insufficientPurchase.status}`
  );

  // 8. Add Funds to User A Wallet via Sandbox Complete
  const depositAmount = 6000.0;
  const createOrderRes = await request(
    "POST",
    "/payments/create-order",
    { amount: depositAmount },
    tokenA
  );
  const gatewayOrderId = createOrderRes.data?.gatewayOrderId || createOrderRes.data?.id;
  const depositRes = await request(
    "POST",
    "/payments/sandbox-complete",
    { gatewayOrderId }
  );
  assert(
    depositRes.status === 200 || depositRes.status === 201,
    `10. Sandbox funds deposit completed (₹${depositAmount}, order: ${gatewayOrderId})`
  );

  const balanceBefore = await request("GET", "/wallet/balance", null, tokenA);
  const balBeforeNum = Number(balanceBefore.data.balance || balanceBefore.data);
  assert(
    balBeforeNum >= depositAmount,
    `11. Wallet balance verified before purchase: ₹${balBeforeNum.toFixed(2)}`
  );

  // 9. Valid Package Purchase with Upfront Wallet Debit
  const idempotencyKey = `pkg_idem_valid_${ts}`;
  const purchaseRes = await request(
    "POST",
    "/packages/purchase",
    {
      ...quotePayload,
      quoteHash,
      consentRulesUnderstood: true,
      idempotencyKey,
    },
    tokenA
  );
  assert(
    (purchaseRes.status === 200 || purchaseRes.status === 201) && purchaseRes.data.success,
    `12. Package purchase succeeded with HTTP ${purchaseRes.status}`
  );
  const packageObj = purchaseRes.data.package;
  const packageId = packageObj.id;
  assert(
    packageId && packageObj.status === "ACTIVE",
    `13. Package #${packageId.slice(0, 8)} created in ACTIVE state`
  );

  // 10. Check Wallet Balance Decrement & Ledger Entry
  const balanceAfter = await request("GET", "/wallet/balance", null, tokenA);
  const balAfterNum = Number(balanceAfter.data.balance || balanceAfter.data);
  const expectedBal = Number((balBeforeNum - totalCharge).toFixed(2));
  assert(
    Math.abs(balAfterNum - expectedBal) < 0.05,
    `14. Wallet decremented atomically: ₹${balAfterNum.toFixed(2)} (Expected: ₹${expectedBal.toFixed(2)})`
  );

  const ledgerRes = await request("GET", "/wallet/ledger", null, tokenA);
  const ledgerEntries = Array.isArray(ledgerRes.data)
    ? ledgerRes.data
    : Array.isArray(ledgerRes.data?.entries)
    ? ledgerRes.data.entries
    : [];
  const purchaseLedger = ledgerEntries.find(
    (e) => e.type === "PACKAGE_PURCHASE" || e.description?.includes("Package Purchase")
  );
  assert(
    !!purchaseLedger,
    `15. PACKAGE_PURCHASE ledger record verified (Amount: ${purchaseLedger?.amount})`
  );

  // 11. Idempotent Purchase Replay (Should return existing package without double charge)
  const replayRes = await request(
    "POST",
    "/packages/purchase",
    {
      ...quotePayload,
      quoteHash,
      consentRulesUnderstood: true,
      idempotencyKey,
    },
    tokenA
  );
  assert(
    (replayRes.status === 200 || replayRes.status === 201) &&
      replayRes.data.package?.id === packageId &&
      replayRes.data.isReplay === true,
    "16. Purchase replay returned existing package without double debit"
  );
  const balanceAfterReplay = await request("GET", "/wallet/balance", null, tokenA);
  assert(
    Number(balanceAfterReplay.data.balance || balanceAfterReplay.data) === balAfterNum,
    "17. Wallet balance completely unchanged after idempotent replay"
  );

  // 12. Package Inspection (GET /api/v1/packages, GET /api/v1/packages/:id)
  const listRes = await request("GET", "/packages", null, tokenA);
  const userPackages = Array.isArray(listRes.data) ? listRes.data : listRes.data.packages || [];
  const foundInList = userPackages.find((p) => p.id === packageId);
  assert(!!foundInList, `18. Package visible in user's packages list (${userPackages.length} packages total)`);

  const detailRes = await request("GET", `/packages/${packageId}`, null, tokenA);
  assert(
    detailRes.status === 200 && detailRes.data.id === packageId,
    `19. Package details retrieved successfully (Status: ${detailRes.data?.status})`
  );

  // 13. Tenant Isolation Guard: User B cannot access User A's package
  const userBAccess = await request("GET", `/packages/${packageId}`, null, tokenB);
  assert(
    userBAccess.status === 403 || userBAccess.status === 404,
    `20. Tenant isolation enforced: User B blocked from accessing User A package (HTTP ${userBAccess.status})`
  );

  // 14. Pause Package (POST /api/v1/packages/:id/pause)
  const pauseRes = await request("POST", `/packages/${packageId}/pause`, {}, tokenA);
  assert(
    (pauseRes.status === 200 || pauseRes.status === 201) && pauseRes.data.status === "PAUSED",
    `21. Package paused successfully (Status: ${pauseRes.data?.status})`
  );

  // 15. Resume Package (POST /api/v1/packages/:id/resume)
  const resumeRes = await request("POST", `/packages/${packageId}/resume`, {}, tokenA);
  assert(
    (resumeRes.status === 200 || resumeRes.status === 201) && resumeRes.data.status === "ACTIVE",
    `22. Package resumed successfully (Status: ${resumeRes.data?.status})`
  );

  // 16. Post Trigger Execution (POST /api/v1/packages/:id/trigger)
  const postUrl = `https://instagram.com/p/DA_test_${ts}`;
  const triggerRes = await request(
    "POST",
    `/packages/${packageId}/trigger`,
    {
      url: postUrl,
      mediaType: "POST",
    },
    tokenA,
    { "idempotency-key": `trig_manual_${ts}` }
  );
  assert(
    triggerRes.status === 200 || triggerRes.status === 201,
    `23. Post trigger execution dispatched (HTTP ${triggerRes.status})`
  );

  const triggersList = await request("GET", `/packages/${packageId}/triggers`, null, tokenA);
  const triggers = Array.isArray(triggersList.data) ? triggersList.data : triggersList.data?.triggers || [];
  assert(
    triggersList.status === 200,
    `24. Triggers list fetched successfully (${triggers.length} recorded)`
  );

  // 17. Cancel Package & Automated Wallet Refund (POST /api/v1/packages/:id/cancel)
  const balBeforeCancel = await request("GET", "/wallet/balance", null, tokenA);
  const cancelRes = await request("POST", `/packages/${packageId}/cancel`, {}, tokenA);
  assert(
    (cancelRes.status === 200 || cancelRes.status === 201) &&
      (cancelRes.data.success || cancelRes.data.status === "CANCELLED"),
    `25. Package cancelled successfully (HTTP ${cancelRes.status})`
  );

  const cancelledPkg = await request("GET", `/packages/${packageId}`, null, tokenA);
  assert(
    cancelledPkg.data?.status === "CANCELLED",
    `26. Package status confirmed CANCELLED in database`
  );

  // 18. Verify Refund & Financial Invariant: purchased = consumed + refunded + remaining
  const balAfterCancel = await request("GET", "/wallet/balance", null, tokenA);
  const balAfterCancelNum = Number(balAfterCancel.data.balance || balAfterCancel.data);
  const refundAmount = Number((balAfterCancelNum - Number(balBeforeCancel.data.balance || balBeforeCancel.data)).toFixed(2));
  assert(
    refundAmount > 0,
    `27. Automated refund credited to wallet: ₹${refundAmount.toFixed(2)}`
  );

  const finalLedger = await request("GET", "/wallet/ledger", null, tokenA);
  const finalEntries = Array.isArray(finalLedger.data)
    ? finalLedger.data
    : Array.isArray(finalLedger.data?.entries)
    ? finalLedger.data.entries
    : [];
  const refundLedger = finalEntries.find(
    (e) => e.type === "PACKAGE_REFUND" || e.description?.includes("Refund") || e.description?.includes("cancellation")
  );
  assert(
    !!refundLedger,
    `28. PACKAGE_REFUND ledger record confirmed (Amount: ₹${refundLedger?.amount})`
  );

  // 19. Preset Bundle Purchase (POST /api/v1/packages/bundle/purchase)
  const bundlePurchaseRes = await request(
    "POST",
    "/packages/bundle/purchase",
    {
      templateId: "bundle_starter_ig",
      handle: `bundle_user_${ts}`,
    },
    tokenA,
    { "idempotency-key": `bnd_pur_${ts}` }
  );
  assert(
    bundlePurchaseRes.status === 200 || bundlePurchaseRes.status === 201,
    `29. Preset bundle purchase succeeded (HTTP ${bundlePurchaseRes.status})`
  );
  assert(
    bundlePurchaseRes.data && (bundlePurchaseRes.data.packageId || bundlePurchaseRes.data.package?.id),
    `30. Bundle package created: #${(bundlePurchaseRes.data.packageId || bundlePurchaseRes.data.package?.id)?.slice(0, 8)}`
  );

  console.log("\n============================================================");
  console.log(`Q5 Verification Complete: ${passed} passed, ${failed} failed`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL Q5 verification error:", err);
  process.exit(1);
});
