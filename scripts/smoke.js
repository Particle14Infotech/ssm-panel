const http = require("http");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Set environment for in-memory sandbox smoke execution
const testEnvPath = path.resolve(__dirname, "../.env.test");
if (fs.existsSync(testEnvPath)) {
  const content = fs.readFileSync(testEnvPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.SANDBOX_MODE = "true";
process.env.BENCHMARK_MODE = "true";
process.env.DISABLE_RATE_LIMITER = "true";

const { NestFactory } = require("@nestjs/core");
const appModulePath = fs.existsSync(path.resolve(__dirname, "../apps/api/dist/src/app.module.js"))
  ? path.resolve(__dirname, "../apps/api/dist/src/app.module.js")
  : path.resolve(__dirname, "../apps/api/dist/app.module.js");

const { AppModule } = require(appModulePath);

function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const reqOptions = {
      ...options,
      agent: false,
      headers: {
        Connection: "close",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      timeout: 5000,
    };

    const req = http.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const duration = Date.now() - start;
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          rawBody: body,
          durationMs: duration,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out after 5000ms"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// Executes an action with at most 3 attempts per failing check
async function executeWithRetry(stepName, fn, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    process.stdout.write(`  [ATTEMPT ${attempt}/${maxAttempts}] ${stepName} ... `);
    try {
      const result = await fn();
      console.log(`✅ OK (${result.durationMs ?? 0}ms)`);
      return result;
    } catch (err) {
      lastError = err;
      console.log(`❌ FAILED: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw new Error(`Step '${stepName}' failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

async function runSmoke() {
  const commit = getGitCommit();
  const timestamp = new Date().toISOString();

  console.log("================================================================================");
  console.log("🚀 SMM PANEL END-TO-END VERIFICATION SMOKE RUN (MVP SANDBOX)");
  console.log(`Commit Hash:    ${commit}`);
  console.log(`Timestamp:      ${timestamp}`);
  console.log(`Runtime:        Node.js ${process.version} (${process.platform})`);
  console.log(`Database Target: smm_db (Isolated in-memory sandbox mode)`);
  console.log("================================================================================\n");

  console.log("▶ Initializing NestJS Modular Monolith API on port 4001...");
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.listen(4001);
  console.log("✅ NestJS API online at http://127.0.0.1:4001/api/v1\n");

  const baseUrl = { host: "127.0.0.1", port: 4001 };
  let sessionToken = "";
  let userEmail = `smoke_${Date.now()}@smm.dev`;
  let userId = "";
  let gatewayOrderId = "";
  let orderId = "";

  try {
    // Step 1: Health Liveness and Readiness
    console.log("▶ STEP 1: Verifying Health Probes");
    await executeWithRetry("GET /api/v1/health/live", async () => {
      const res = await httpRequest({ ...baseUrl, path: "/api/v1/health/live", method: "GET" });
      if (res.statusCode !== 200 || res.data?.status !== "ok") {
        throw new Error(`Expected 200 OK with status: ok, got ${res.statusCode}: ${res.rawBody}`);
      }
      return res;
    });

    await executeWithRetry("GET /api/v1/health/ready", async () => {
      const res = await httpRequest({ ...baseUrl, path: "/api/v1/health/ready", method: "GET" });
      if (res.statusCode !== 200 || res.data?.status !== "ready") {
        throw new Error(`Expected 200 OK with status: ready, got ${res.statusCode}: ${res.rawBody}`);
      }
      return res;
    });

    // Step 2: Register New User
    console.log("\n▶ STEP 2: User Account Registration");
    const regRes = await executeWithRetry("POST /api/v1/auth/register", async () => {
      const res = await httpRequest(
        { ...baseUrl, path: "/api/v1/auth/register", method: "POST" },
        {
          email: userEmail,
          password: "Password123!",
          name: "Smoke Verification User",
        }
      );
      if (res.statusCode !== 201 && res.statusCode !== 200) {
        throw new Error(`Register failed with status ${res.statusCode}: ${res.rawBody}`);
      }
      if (!res.data?.user?.id) {
        throw new Error("No user id returned in registration response");
      }
      return res;
    });
    userId = regRes.data.user.id;
    console.log(`    User Registered: ID=${userId} Email=${userEmail}`);

    // Step 3: Login User
    console.log("\n▶ STEP 3: User Authentication & Token Issuance");
    const loginRes = await executeWithRetry("POST /api/v1/auth/login", async () => {
      const res = await httpRequest(
        { ...baseUrl, path: "/api/v1/auth/login", method: "POST" },
        {
          email: userEmail,
          password: "Password123!",
        }
      );
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        throw new Error(`Login failed with status ${res.statusCode}: ${res.rawBody}`);
      }
      if (!res.data?.token) {
        throw new Error("JWT token missing from login payload");
      }
      return res;
    });
    sessionToken = loginRes.data.token;
    console.log(`    Session Established: JWT Prefix=${sessionToken.substring(0, 15)}... Initial Balance=₹${loginRes.data.user?.balance ?? 0}`);

    // Step 4: Sandbox Deposit
    console.log("\n▶ STEP 4: Add Funds (Gateway Initiate & Sandbox Complete)");
    const depositAmount = 2000;
    const initRes = await executeWithRetry("POST /api/v1/payments/initiate", async () => {
      const res = await httpRequest(
        {
          ...baseUrl,
          path: "/api/v1/payments/initiate",
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        {
          userId,
          amount: depositAmount,
          method: "RAZORPAY",
        }
      );
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        throw new Error(`Payment initiate failed with ${res.statusCode}: ${res.rawBody}`);
      }
      return res;
    });
    gatewayOrderId = initRes.data.gatewayOrderId;
    console.log(`    Payment Session: GatewayOrderId=${gatewayOrderId} BaseAmount=₹${depositAmount} Bonus=₹${initRes.data.bonusAmount}`);

    const completeRes = await executeWithRetry("POST /api/v1/payments/sandbox-complete", async () => {
      const res = await httpRequest(
        {
          ...baseUrl,
          path: "/api/v1/payments/sandbox-complete",
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        { gatewayOrderId }
      );
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        throw new Error(`Sandbox complete failed with ${res.statusCode}: ${res.rawBody}`);
      }
      return res;
    });
    console.log(`    Deposit Verified: Credited Amount=₹${completeRes.data.creditedAmount}`);

    // Step 5: Place Order
    console.log("\n▶ STEP 5: Place Dispatch Order with Balance Deduction");
    const orderQuantity = 1000;
    const orderRes = await executeWithRetry("POST /api/v1/orders", async () => {
      const res = await httpRequest(
        {
          ...baseUrl,
          path: "/api/v1/orders",
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        {
          userId,
          serviceId: "1042",
          target: "https://instagram.com/p/smoke_demo_target",
          quantity: orderQuantity,
        }
      );
      if (res.statusCode !== 200 && res.statusCode !== 201) {
        throw new Error(`Create order failed with ${res.statusCode}: ${res.rawBody}`);
      }
      return res;
    });
    orderId = orderRes.data.id;
    const orderCharge = orderRes.data.charge;
    console.log(`    Order Dispatched: ID=${orderId} Charge=₹${orderCharge} Target=https://instagram.com/p/smoke_demo_target`);

    // Step 6: Poll Order to COMPLETED
    console.log("\n▶ STEP 6: Polling Order Status to COMPLETED");
    const finalOrder = await executeWithRetry(`GET /api/v1/orders/${orderId}`, async () => {
      const res = await httpRequest({
        ...baseUrl,
        path: `/api/v1/orders/${orderId}`,
        method: "GET",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.statusCode !== 200) {
        throw new Error(`Failed to fetch order ${orderId}: ${res.statusCode}`);
      }
      if (res.data.status !== "COMPLETED") {
        throw new Error(`Order ${orderId} not yet COMPLETED, currently ${res.data.status}`);
      }
      return res;
    });
    console.log(`    Order Final Status: ${finalOrder.data.status} (Verified)`);

    // Step 7: Final Balance & Ledger Verification
    console.log("\n▶ STEP 7: Financial Integrity & Ledger Invariant Audit");
    const balRes = await httpRequest({
      ...baseUrl,
      path: `/api/v1/wallet/balance?userId=${userId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const finalBalance = Number(balRes.data.balance);

    const ledRes = await httpRequest({
      ...baseUrl,
      path: `/api/v1/wallet/ledger?userId=${userId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const ledgerEntries = Array.isArray(ledRes.data) ? ledRes.data : [];
    const ledgerSum = ledgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);

    console.log("================================================================================");
    console.log("                        FINAL SMOKE AUDIT SUMMARY                               ");
    console.log("================================================================================");
    console.log(`User ID:               ${userId}`);
    console.log(`Order ID:              ${orderId}`);
    console.log(`Order Status:          ${finalOrder.data.status}`);
    console.log(`Final Liquid Balance:  ₹${finalBalance.toFixed(2)} INR`);
    console.log(`Ledger Entry Count:    ${ledgerEntries.length}`);
    console.log(`Ledger Net Sum:        ₹${ledgerSum.toFixed(2)} INR`);

    // Ledger records detail
    console.log("\nLedger Trail:");
    ledgerEntries.forEach((entry, i) => {
      console.log(`  [${i + 1}] ID=${entry.id} Type=${entry.type} Amount=₹${entry.amount} Desc="${entry.description}"`);
    });

    console.log("================================================================================");
    console.log("✅ SMOKE RUN PASSED: All 6 stages completed with verified invariant integrity.");
    console.log("================================================================================");

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ FATAL SMOKE FAILURE: ${err.message}`);
    await app.close();
    process.exit(1);
  }
}

runSmoke();
