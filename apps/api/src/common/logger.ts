import pino from "pino";

// Sensitive fields to redact strictly
const PII_CENSORED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "password",
  "passwordHash",
  "refreshToken",
  "apiKey",
  "secret",
  "twoFactorSecret",
  "token",
];

export const smmLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: PII_CENSORED_PATHS,
    censor: "[REDACTED_PII]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
