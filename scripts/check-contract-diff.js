const fs = require("fs");
const path = require("path");

const openApiPath = path.resolve(__dirname, "../docs/openapi.json");
if (!fs.existsSync(openApiPath)) {
  console.error("OpenAPI spec not found at docs/openapi.json. Run export-openapi first.");
  process.exit(1);
}

const openApi = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
const openApiPaths = openApi.paths || {};

// Normalizes path for matching, replacing {param} with :param
function normalizePath(p) {
  return p.replace(/\{([^}]+)\}/g, ":$1");
}

const registeredRoutes = new Set();
for (const [routePath, methods] of Object.entries(openApiPaths)) {
  const norm = normalizePath(routePath);
  for (const method of Object.keys(methods)) {
    registeredRoutes.add(`${method.toUpperCase()} ${norm}`);
  }
}

// Extracted API calls from apps/web and packages/contracts
const webCalls = [
  { method: "GET", path: "/api/v1/health/live", source: "apps/web/monitoring & probes" },
  { method: "GET", path: "/api/v1/health/ready", source: "apps/web/monitoring & probes" },
  { method: "POST", path: "/api/v1/auth/login", source: "apps/web/app/(auth)/login" },
  { method: "POST", path: "/api/v1/auth/register", source: "apps/web/app/(auth)/register" },
  { method: "POST", path: "/api/v1/auth/refresh", source: "apps/web/lib/auth-session" },
  { method: "GET", path: "/api/v1/auth/verify-key", source: "packages/contracts/src/auth.ts" },
  { method: "GET", path: "/api/v1/services", source: "apps/web/app/app/api & catalog" },
  { method: "GET", path: "/api/v1/services/:id", source: "apps/web/services-catalog" },
  { method: "GET", path: "/api/v1/orders", source: "apps/web/app/(customer)/orders" },
  { method: "GET", path: "/api/v1/orders/:id", source: "apps/web/app/app/api & orders" },
  { method: "POST", path: "/api/v1/orders", source: "apps/web/orders (Canonical REST)" },
  { method: "POST", path: "/api/v1/orders/create", source: "apps/web/app/app/api & CustomerContext" },
  { method: "POST", path: "/api/v1/orders/:id/refill", source: "apps/web/orders refill" },
  { method: "POST", path: "/api/v1/orders/:id/cancel", source: "apps/web/orders cancel" },
  { method: "GET", path: "/api/v1/wallet/balance", source: "apps/web/app/app/api & wallet" },
  { method: "POST", path: "/api/v1/wallet/deposit", source: "apps/web/app/(customer)/wallet" },
  { method: "GET", path: "/api/v1/providers", source: "apps/web/admin/providers" },
  { method: "POST", path: "/api/v1/providers", source: "apps/web/admin/providers (Canonical REST)" },
  { method: "POST", path: "/api/v1/providers/create", source: "apps/web/context/AdminContext.tsx:214" },
  { method: "POST", path: "/api/v1/providers/:id/sync", source: "apps/web/context/AdminContext.tsx:244" },
  { method: "GET", path: "/api/v1/users/me", source: "apps/web/app/(customer)/profile" },
  { method: "PUT", path: "/api/v1/users/me", source: "apps/web/app/(customer)/profile" },
  { method: "GET", path: "/api/v1/tickets", source: "apps/web/app/(customer)/support" },
  { method: "POST", path: "/api/v1/tickets", source: "apps/web/support tickets (Canonical REST)" },
  { method: "POST", path: "/api/v1/tickets/create", source: "apps/web/support tickets" },
];

let hasMismatch = false;
const diffResults = [];

for (const call of webCalls) {
  const key = `${call.method} ${call.path}`;
  const exists = registeredRoutes.has(key);
  if (!exists) {
    hasMismatch = true;
  }
  diffResults.push({
    call: key,
    source: call.source,
    exists: exists ? "YES" : "NO",
  });
}

// Generate docs/CONTRACT_DIFF.md
let md = `# Contract Drift & OpenAPI Alignment Matrix\n\n`;
md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
md += `**Status:** ${hasMismatch ? "MISMATCH DETECTED" : "ALIGNED (0 Mismatches)"}\n\n`;
md += `| Web / Contract Call | Source Location | Exists in OpenAPI | Status |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

for (const r of diffResults) {
  const statusIcon = r.exists === "YES" ? "✅ PASS" : "❌ FAIL";
  md += `| \`${r.call}\` | ${r.source} | **${r.exists}** | ${statusIcon} |\n`;
}

const contractDiffPath = path.resolve(__dirname, "../docs/CONTRACT_DIFF.md");
fs.writeFileSync(contractDiffPath, md, "utf8");
console.log(`Updated ${contractDiffPath}`);

console.log("\n--- CONTRACT DIFF REPORT ---");
console.table(diffResults);

if (hasMismatch) {
  console.error("\n❌ Contract verification failed: Missing endpoints in OpenAPI specification!");
  process.exit(1);
} else {
  console.log("\n✅ Contract verification passed: All web and contract endpoints exist in OpenAPI.");
  process.exit(0);
}
