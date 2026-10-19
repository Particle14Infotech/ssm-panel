import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY = "smm_panel_super_secure_key_32_bytes!!"; // 32 bytes

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || DEFAULT_KEY;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive text (e.g. OAuth access token) using AES-256-GCM
 */
export function encryptToken(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts sensitive token encrypted with AES-256-GCM
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) return "";
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return "";
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}
