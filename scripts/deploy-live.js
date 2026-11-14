const { execSync } = require("child_process");

console.log("================================================================================");
console.log("           STARTING MANUAL 1-CLICK ZERO-BUILD LIVE VPS DEPLOYMENT               ");
console.log("================================================================================");

try {
  console.log("\n[1/3] Building Next.js Web locally (Zero-Build on VPS rule)...");
  execSync("pnpm --filter @smm/web build", { stdio: "inherit", shell: true });

  console.log("\n[2/3] Packaging standalone bundle into web_dist.tar.gz...");
  execSync("node scripts/pack-standalone.js", { stdio: "inherit", shell: true });

  console.log("\n[3/3] Uploading artifacts, restarting containers and verifying health on VPS...");
  execSync("node scripts/deploy-artifacts-vps.js", { stdio: "inherit", shell: true });

  console.log("\n>>> LIVE DEPLOYMENT COMPLETE & VERIFIED SUCCESSFULLY! <<<");
} catch (err) {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
}
