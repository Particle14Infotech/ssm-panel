import fs from "fs";
import path from "path";
import { getAllIntegrationsStatus, validateProductionReadiness } from "../apps/api/src/config/externals.ts";

// Load .env manually if exists
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function formatStatus(status: "live" | "sandbox" | "disabled"): string {
  if (status === "live") return "\x1b[32m[LIVE]\x1b[0m";
  if (status === "sandbox") return "\x1b[33m[SANDBOX / MOCK]\x1b[0m";
  return "\x1b[90m[DISABLED]\x1b[0m";
}

function runCheck() {
  const isProd = process.env.NODE_ENV === "production";
  console.log("\n=======================================================");
  console.log("       SMM PANEL EXTERNAL INTEGRATIONS REGISTRY       ");
  console.log(`       Runtime Mode: ${isProd ? "PRODUCTION" : "DEVELOPMENT / SANDBOX"}        `);
  console.log("=======================================================\n");

  const statuses = getAllIntegrationsStatus(process.env);

  console.log(
    "INTEGRATION".padEnd(28) +
      "REQUIRED".padEnd(14) +
      "MODE".padEnd(20) +
      "MISSING / PLACEHOLDERS"
  );
  console.log("-".repeat(84));

  for (const item of statuses) {
    const missingStr =
      item.missingVars.length > 0 ? item.missingVars.join(", ") : "None (All Set)";
    console.log(
      item.name.padEnd(28) +
        item.required.padEnd(14) +
        formatStatus(item.mode).padEnd(28) +
        missingStr
    );
  }

  console.log("-".repeat(84));

  const validation = validateProductionReadiness(process.env);

  if (isProd) {
    if (!validation.ready) {
      console.error("\n❌ PRODUCTION BOOT REFUSED: Missing required live credentials:");
      for (const v of validation.violations) {
        console.error(`  - ${v}`);
      }
      console.error(
        "\nProvide actual credentials or explicitly set <ID>_MODE=disabled. Exiting with status 1.\n"
      );
      process.exit(1);
    } else {
      console.log("\n✅ All MVP-Live integrations are verified for production deployment.\n");
    }
  } else {
    console.log("\nℹ️  Development/Test Mode: Sandboxes and Mocks active where keys are placeholders.\n");
  }
}

runCheck();
