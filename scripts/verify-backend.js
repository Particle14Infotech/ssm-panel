const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function runStep(name, cmd) {
  const startTime = Date.now();
  console.log(`\n================================================================================`);
  console.log(`▶ RUNNING STEP: ${name}`);
  console.log(`  Command: ${cmd}`);
  console.log(`================================================================================`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ [PASS] ${name} (${duration}s)`);
    return { name, cmd, status: "PASS", duration };
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ [FAIL] ${name} (${duration}s)`);
    return { name, cmd, status: "FAIL", duration };
  }
}

async function main() {
  const overallStart = Date.now();
  console.log("################################################################################");
  console.log("        SMM PANEL AUTHORITATIVE BACKEND PRODUCTION GATE VERIFIER                ");
  console.log("################################################################################");

  const steps = [
    {
      name: "R0: Contract Diff Audit",
      cmd: "node scripts/check-contract-diff.js",
    },
    {
      name: "R1: OpenAPI Specification Export",
      cmd: "node apps/api/scripts/export-openapi.js",
    },
    {
      name: "R1: Endpoints Markdown Generation",
      cmd: "node scripts/generate-endpoints-md.js",
    },
    {
      name: "R1: Functional Domain Unit Suites",
      cmd: "pnpm --filter @smm/api test:unit",
    },
    {
      name: "R2: Core Invariant Suite (INV-01 to INV-15)",
      cmd: "pnpm --filter @smm/api test:invariants",
    },
    {
      name: "R4: Resilience & Chaos Drills (5 Drills)",
      cmd: "node scripts/drills/run-all-drills.js",
    },
    {
      name: "R4: Database Snapshot & Restore Drill",
      cmd: "node scripts/backup/run-backup-drill.js",
    },
    {
      name: "R5: Security & DAST Scan Suite",
      cmd: "pnpm --filter @smm/api test:security",
    },
    {
      name: "R6: Clean API Production Build",
      cmd: "pnpm --filter @smm/api build",
    },
  ];

  const results = [];
  for (const step of steps) {
    const res = runStep(step.name, step.cmd);
    results.push(res);
    if (res.status === "FAIL") {
      console.error(`\n❌ Verification halted due to failure in step: ${step.name}`);
      process.exit(1);
    }
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  console.log("\n################################################################################");
  console.log("                        BACKEND VERIFICATION SUMMARY TABLE                      ");
  console.log("################################################################################");
  console.log(
    "STEP NAME".padEnd(46) + "STATUS".padEnd(12) + "DURATION"
  );
  console.log("-".repeat(70));
  for (const r of results) {
    console.log(
      r.name.padEnd(46) + (r.status === "PASS" ? "✅ PASS" : "❌ FAIL").padEnd(12) + `${r.duration}s`
    );
  }
  console.log("-".repeat(70));
  console.log(`TOTAL GATE RUNTIME: ${totalDuration}s`);
  console.log("ALL 9 BACKEND GATE CHECKS PASSED WITH ZERO ERRORS.");
  console.log("################################################################################\n");
}

main().catch((err) => {
  console.error("FATAL ERROR in verify-backend:", err);
  process.exit(1);
});
