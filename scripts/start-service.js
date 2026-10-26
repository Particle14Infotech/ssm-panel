const { execSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");

function detectService() {
  const raw = (process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || process.env.RENDER_SERVICE_NAME || "").trim().toLowerCase();
  if (raw.includes("web") || raw.includes("front") || raw.includes("client") || raw.includes("next")) {
    return "web";
  }
  if (raw.includes("worker") || raw.includes("queue") || raw.includes("bull")) {
    return "worker";
  }
  return "smm";
}

const service = detectService();
console.log(`[start-service] Target service: ${service} (raw: "${process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'default'}")`);

function run(cmd) {
  console.log(`[start-service] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function applyDatabaseMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn("[start-service] DATABASE_URL is not set. Skipping database migration step.");
    return;
  }

  console.log("[start-service] Deploying committed Prisma migrations (prisma migrate deploy)...");
  try {
    run("pnpm exec prisma migrate deploy");
    console.log("[start-service] Prisma migrations applied successfully.");
  } catch (err) {
    console.warn("[start-service] Warning: prisma migrate deploy did not complete:", err.message);
    try {
      console.log("[start-service] Synchronizing Prisma schema to PostgreSQL (fallback prisma db push)...");
      run("pnpm exec prisma db push --skip-generate");
      console.log("[start-service] Database schema synchronized successfully.");
    } catch (pushErr) {
      console.warn("[start-service] Note: db push warning:", pushErr.message);
    }
  }

  try {
    console.log("[start-service] Running idempotent database seed...");
    run("node scripts/seed.js");
    console.log("[start-service] Database seed completed.");
  } catch (seedErr) {
    console.warn("[start-service] Note: seed warning:", seedErr.message);
  }
}

if (service === "web") {
  if (!fs.existsSync("apps/web/.next")) {
    console.log("[start-service] .next directory missing. Building web service now...");
    run("pnpm --filter @smm/contracts build");
    run("pnpm --filter @smm/web build");
  }
  const port = process.env.PORT || 3000;
  console.log(`[start-service] Starting Next.js web application on port ${port}...`);
  run(`pnpm --filter @smm/web exec next start -p ${port}`);
} else if (service === "worker") {
  if (!fs.existsSync("apps/worker/dist/main.js")) {
    console.log("[start-service] Worker dist missing. Building worker service now...");
    run("pnpm --filter @smm/contracts build");
    run("pnpm exec prisma generate");
    run("pnpm --filter @smm/worker build");
  }

  if (process.env.DATABASE_URL) {
    try {
      console.log("[start-service] Ensuring database schema is synced for worker...");
      run("pnpm exec prisma db push --skip-generate");
    } catch (err) {
      console.warn("[start-service] Note: worker db sync notice:", err.message);
    }
  }

  run("pnpm --filter @smm/worker start");
} else {
  // smm / api:
  // Fallbacks for secrets if aliases or standard names are used
  const baseSeed = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || process.env.DATABASE_URL || "smm_production_secure_salt_key_32bytes";
  if (!process.env.JWT_ACCESS_SECRET) {
    if (process.env.JWT_SECRET) {
      process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = crypto.createHmac("sha256", baseSeed).update("jwt_access_salt").digest("hex");
    }
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET = crypto.createHmac("sha256", baseSeed).update("jwt_refresh_salt").digest("hex");
  }
  if (!process.env.COOKIE_SECRET) {
    process.env.COOKIE_SECRET = crypto.createHmac("sha256", baseSeed).update("cookie_salt").digest("hex");
  }
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = crypto.createHmac("sha256", baseSeed).update("encryption_key_salt").digest("hex");
  }
  if (!process.env.QUOTE_SECRET) {
    process.env.QUOTE_SECRET = crypto.createHmac("sha256", baseSeed).update("quote_secret_salt").digest("hex");
  }

  applyDatabaseMigrations();

  const apiDistExists = fs.existsSync("apps/api/dist/main.js") || fs.existsSync("apps/api/dist/src/main.js");
  if (!apiDistExists) {
    console.log("[start-service] Compiling @smm/api dist before launch...");
    run("pnpm --filter @smm/contracts build");
    run("pnpm exec prisma generate");
    run("pnpm --filter @smm/api build");
  }

  const entryFile = fs.existsSync("apps/api/dist/main.js")
    ? "apps/api/dist/main.js"
    : fs.existsSync("apps/api/dist/src/main.js")
    ? "apps/api/dist/src/main.js"
    : null;

  if (entryFile) {
    run(`node ${entryFile}`);
  } else {
    run("pnpm --filter @smm/api start:prod");
  }
}

