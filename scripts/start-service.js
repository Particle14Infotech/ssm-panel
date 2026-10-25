const { execSync } = require("child_process");
const fs = require("fs");

function detectService() {
  const raw = (process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || "").trim().toLowerCase();
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

function verifyDatabaseMigrations() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[start-service] DATABASE_URL is required in production.");
    }
    console.warn("[start-service] DATABASE_URL is not set. Skipping migration status check.");
    return;
  }

  console.log("[start-service] Verifying committed Prisma migration status (read-only)...");
  run("pnpm exec prisma migrate status");
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
  verifyDatabaseMigrations();
  run("pnpm --filter @smm/worker start");
} else {
  // smm / api:
  // Fallbacks for secrets if aliases or standard names are used
  if (!process.env.JWT_ACCESS_SECRET && process.env.JWT_SECRET) {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
  }
  if (!process.env.JWT_REFRESH_SECRET && process.env.JWT_SECRET) {
    process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET + "_refresh";
  }
  verifyDatabaseMigrations();

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
