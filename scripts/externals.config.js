const fs = require("fs");
const path = require("path");

function isPlaceholder(val) {
  if (!val) return true;
  const trimmed = val.trim();
  return trimmed === "" || trimmed.startsWith("REPLACE_ME");
}

const EXTERNALS_REGISTRY = {
  database: {
    id: "database",
    name: "PostgreSQL Database",
    required: "mvp-live",
    envVars: ["DATABASE_URL"],
    description: "PostgreSQL authoritative primary database with transactional integrity",
  },
  redis: {
    id: "redis",
    name: "Redis Cache & BullMQ",
    required: "mvp-live",
    envVars: ["REDIS_HOST"],
    description: "Redis in-memory store for BullMQ background queues and fast caching",
  },
  payments: {
    id: "payments",
    name: "Razorpay Payment Gateway",
    required: "mvp-live",
    envVars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    description: "Payment gateway for customer wallet deposits and INR settlements",
  },
  smtp: {
    id: "smtp",
    name: "SMTP Email Server",
    required: "mvp-live",
    envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
    description: "Transactional email provider for OTPs, order alerts, and password resets",
  },
  storage: {
    id: "storage",
    name: "S3-Compatible Storage",
    required: "optional",
    envVars: ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"],
    description: "Object storage for ticket attachments and report exports (defaults to local disk)",
  },
  sentryApi: {
    id: "sentry-api",
    name: "Sentry API Error Tracking",
    required: "optional",
    envVars: ["SENTRY_DSN"],
    description: "Real-time exception and performance tracking for the NestJS API",
  },
  sentryWeb: {
    id: "sentry-web",
    name: "Sentry Web Error Tracking",
    required: "optional",
    envVars: ["NEXT_PUBLIC_SENTRY_DSN"],
    description: "Real-time client-side error and crash monitoring for the Next.js app",
  },
  snyk: {
    id: "snyk",
    name: "Snyk Security Scanner",
    required: "optional",
    envVars: ["SNYK_TOKEN"],
    description: "Automated vulnerability and license scanner for CI pipelines",
  },
  backupStorage: {
    id: "backup-storage",
    name: "Offsite Backup Storage",
    required: "optional",
    envVars: ["BACKUP_S3_BUCKET", "BACKUP_ENCRYPTION_KEY"],
    description: "Secure AES-256 encrypted database snapshots offsite archive destination",
  },
};

function getAllIntegrationsStatus(env = process.env) {
  return Object.keys(EXTERNALS_REGISTRY).map((id) => {
    const item = EXTERNALS_REGISTRY[id];
    const missingVars = item.envVars.filter((v) => isPlaceholder(env[v]));
    const isExplicitlyDisabled = env[`${id.toUpperCase().replace("-", "_")}_MODE`] === "disabled";

    let mode = "sandbox";
    if (isExplicitlyDisabled) {
      mode = "disabled";
    } else if (missingVars.length === 0) {
      mode = "live";
    } else {
      mode = "sandbox";
    }

    return {
      id: item.id,
      name: item.name,
      required: item.required,
      mode,
      missingVars,
      description: item.description,
    };
  });
}

function validateProductionReadiness(env = process.env) {
  const statuses = getAllIntegrationsStatus(env);
  const violations = [];

  for (const s of statuses) {
    if (s.required === "mvp-live" && s.mode === "sandbox") {
      violations.push(
        `CRITICAL: Integration '${s.name}' (${s.id}) is in SANDBOX mode because variables are missing or set to placeholders: [${s.missingVars.join(
          ", "
        )}]`
      );
    }
  }

  return {
    ready: violations.length === 0,
    violations,
  };
}

module.exports = {
  EXTERNALS_REGISTRY,
  isPlaceholder,
  getAllIntegrationsStatus,
  validateProductionReadiness,
};
