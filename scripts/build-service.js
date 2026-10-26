const { execSync } = require("child_process");

function detectService() {
  const raw = (process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || process.env.RENDER_SERVICE_NAME || "").trim().toLowerCase();
  if (process.env.BUILD_ALL === "true" || raw === "all") {
    return "all";
  }
  if (raw.includes("web") || raw.includes("front") || raw.includes("client") || raw.includes("next")) {
    return "web";
  }
  if (raw.includes("worker") || raw.includes("queue") || raw.includes("bull")) {
    return "worker";
  }
  return "smm";
}

const service = detectService();
console.log(`[build-service] Target service: ${service} (raw: "${process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || 'default'}")`);

function run(cmd) {
  console.log(`[build-service] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

const fs = require("fs");

function runPrismaGenerate() {
  try {
    run("pnpm exec prisma generate");
  } catch (err) {
    if (fs.existsSync("node_modules/.prisma/client") || fs.existsSync("node_modules/@prisma/client")) {
      console.warn("[build-service] Warning: prisma generate encountered an issue, but existing Prisma client detected. Continuing build:", err.message);
    } else {
      throw err;
    }
  }
}

if (service === "web") {
  run("pnpm --filter @smm/contracts build");
  run("pnpm --filter @smm/web build");
} else if (service === "worker") {
  run("pnpm --filter @smm/contracts build");
  runPrismaGenerate();
  run("pnpm --filter @smm/worker build");
} else if (service === "all") {
  run("pnpm --filter @smm/contracts build");
  runPrismaGenerate();
  run("pnpm --filter @smm/api build");
  run("pnpm --filter @smm/worker build");
  run("pnpm --filter @smm/web build");
} else {
  // smm / api
  run("pnpm --filter @smm/contracts build");
  runPrismaGenerate();
  run("pnpm --filter @smm/api build");
}

console.log(`[build-service] Build completed successfully for: ${service}`);

