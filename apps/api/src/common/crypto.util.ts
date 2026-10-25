import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits auth tag

/**
 * Derives or validates 32-byte master encryption key from environment variable
 */
let ephemeralDevMasterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.PROVIDER_KEY_ENCRYPTION_KEY ||
    process.env.PROVIDER_KEY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY must be configured in production.");
    }
    if (!ephemeralDevMasterKey) {
      ephemeralDevMasterKey = crypto.randomBytes(32);
    }
    return ephemeralDevMasterKey;
  }
  if (secret.length === 64) {
    // Hex string 32 bytes
    return Buffer.from(secret, "hex");
  }
  return crypto.scryptSync(secret, "salt_smm", 32);
}

/**
 * Encrypts provider API secret using AES-256-GCM
 * Returns payload formatted as: iv:authTag:ciphertext (base64)
 */
export function encryptProviderKey(plainKey: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plainKey, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypts provider API secret using AES-256-GCM
 * Throws error if ciphertext or tag was tampered with
 */
export function decryptProviderKey(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format. Expected iv:authTag:ciphertext");
  }

  const [ivBase64, authTagBase64, cipherBase64] = parts;
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
