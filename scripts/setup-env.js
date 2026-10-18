const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const envExamplePath = path.join(rootDir, ".env.example");
const envPath = path.join(rootDir, ".env");

if (!fs.existsSync(envExamplePath)) {
  console.error("Error: .env.example not found.");
  process.exit(1);
}

// Generate high-entropy cryptographic keys
const jwtAccessSecret = crypto.randomBytes(48).toString("base64");
const jwtRefreshSecret = crypto.randomBytes(48).toString("base64");
const passwordPepper = crypto.randomBytes(32).toString("base64");
const cookieSecret = crypto.randomBytes(32).toString("base64");
const providerKeySecret = crypto.randomBytes(32).toString("hex");
const adminPassword = crypto.randomBytes(16).toString("hex");

let envContent = fs.readFileSync(envExamplePath, "utf8");

// Replace security key placeholders
envContent = envContent.replace(/REPLACE_ME_JWT_ACCESS_SECRET/g, jwtAccessSecret);
envContent = envContent.replace(/REPLACE_ME_JWT_REFRESH_SECRET/g, jwtRefreshSecret);
envContent = envContent.replace(/REPLACE_ME_PASSWORD_PEPPER/g, passwordPepper);
envContent = envContent.replace(/REPLACE_ME_COOKIE_SECRET/g, cookieSecret);
envContent = envContent.replace(/REPLACE_ME_PROVIDER_KEY_SECRET/g, providerKeySecret);
envContent = envContent.replace(/REPLACE_ME_PROVIDER_KEY_ENCRYPTION_KEY/g, providerKeySecret);
envContent = envContent.replace(/REPLACE_ME_ADMIN_PASSWORD/g, adminPassword);

// Set dev fallbacks for database/redis
envContent = envContent.replace(/REPLACE_ME_DATABASE_URL/g, "postgresql://postgres:postgres@localhost:5432/smm_db?schema=public");
envContent = envContent.replace(/REPLACE_ME_REDIS_URL/g, "redis://localhost:6379");
envContent = envContent.replace(/REPLACE_ME_REDIS_HOST/g, "localhost");
envContent = envContent.replace(/REPLACE_ME_REDIS_PASSWORD/g, "");

// Enable simulated payments for development
envContent = envContent.replace(/ALLOW_SIMULATED_PAYMENTS=false/g, "ALLOW_SIMULATED_PAYMENTS=true");

fs.writeFileSync(envPath, envContent, { mode: 0o600 });

console.log("SUCCESS: .env created with cryptographically secure random secrets.");
console.log("Security Keys Configured: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PASSWORD_PEPPER, COOKIE_SECRET, PROVIDER_KEY_SECRET, PROVIDER_KEY_ENCRYPTION_KEY.");
console.log("All secret values are securely written to .env (git-ignored) and redacted from logs.");
