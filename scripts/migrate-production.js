const { execSync } = require("child_process");

if (process.env.CONFIRM_MIGRATE !== "yes") {
  console.error(
    "====================================================================\n" +
    "[SAFETY GATE] Migration deployment aborted.\n" +
    "This script applies Prisma migrations to the configured database.\n" +
    "To proceed, you must explicitly confirm by setting:\n" +
    "  CONFIRM_MIGRATE=yes node scripts/migrate-production.js\n" +
    "===================================================================="
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("[migrate-production] Error: DATABASE_URL is not set.");
  process.exit(1);
}

// Redact password from DATABASE_URL for logging
try {
  const parsed = new URL(process.env.DATABASE_URL);
  console.log(`[migrate-production] Target database host: ${parsed.host}, database: ${parsed.pathname}`);
} catch {
  console.log("[migrate-production] DATABASE_URL provided (format unparsed).");
}

console.log("[migrate-production] Running: pnpm exec prisma migrate deploy");
try {
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit" });
  console.log("[migrate-production] prisma migrate deploy completed successfully.");
} catch (err) {
  console.error("[migrate-production] Migration failed:", err.message);
  process.exit(1);
}
