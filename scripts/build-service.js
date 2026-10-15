const { execSync } = require("child_process");

const service = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || "smm";
console.log(`[build-service] Detected target service: ${service}`);

function run(cmd) {
  console.log(`[build-service] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

if (service === "web") {
  run("pnpm --filter @smm/contracts build");
  run("pnpm --filter @smm/web build");
} else if (service === "worker") {
  run("pnpm --filter @smm/contracts build");
  run("pnpm exec prisma generate");
  run("pnpm --filter @smm/worker build");
} else {
  // smm / api
  run("pnpm --filter @smm/contracts build");
  run("pnpm exec prisma generate");
  run("pnpm --filter @smm/api build");
}

console.log(`[build-service] Build completed successfully for: ${service}`);
