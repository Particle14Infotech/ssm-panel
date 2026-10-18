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
  if (process.env.DATABASE_URL) {
    try {
      console.log("[start-service] Ensuring database schema is synced for worker...");
      run("pnpm exec prisma db push --skip-generate");
    } catch (err) {
      console.warn("[start-service] Note: db sync warning on worker boot:", err.message);
    }
  }
  run("pnpm --filter @smm/worker start");
} else {
  // smm / api: synchronize database schema, run seed, then start server
  try {
    console.log("[start-service] Synchronizing Prisma schema to PostgreSQL...");
    run("pnpm exec prisma db push --skip-generate");
    console.log("[start-service] Database schema synchronized successfully.");
  } catch (err) {
    console.warn("[start-service] Note: db schema push warning:", err.message);
  }

  try {
    console.log("[start-service] Running idempotent seed...");
    run("node scripts/seed.js");
    console.log("[start-service] Database seeded successfully.");
  } catch (err) {
    console.warn("[start-service] Note: db seed warning:", err.message);
  }
  run("node apps/api/dist/main.js || node apps/api/dist/src/main.js || node apps/api/dist/api/src/main.js || pnpm --filter @smm/api start:prod");
}
