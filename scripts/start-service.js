const { execSync } = require("child_process");

const service = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || "smm";
console.log(`[start-service] Detected target service: ${service}`);

function run(cmd) {
  console.log(`[start-service] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

if (service === "web") {
  run("pnpm --filter @smm/web start");
} else if (service === "worker") {
  run("pnpm --filter @smm/worker start");
} else {
  // smm / api: synchronize prisma schema first, then start server
  try {
    console.log("[start-service] Running Prisma schema synchronization...");
    run("pnpm exec prisma db push --skip-generate");
    console.log("[start-service] Database schema synchronized.");
    console.log("[start-service] Running idempotent seed...");
    run("node scripts/seed.js");
  } catch (err) {
    console.warn("[start-service] Note: db sync/seed warning:", err.message);
  }
  run("node apps/api/dist/src/main.js || node apps/api/dist/main.js || pnpm --filter @smm/api start:prod");
}
