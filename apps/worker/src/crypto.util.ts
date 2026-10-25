import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let ephemeralWorkerDevMasterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.PROVIDER_KEY_ENCRYPTION_KEY ||
    process.env.PROVIDER_KEY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY must be configured in production.");
    }
    if (!ephemeralWorkerDevMasterKey) {
      ephemeralWorkerDevMasterKey = crypto.randomBytes(32);
    }
    return ephemeralWorkerDevMasterKey;
  }
  if (secret.length === 64) {
    return Buffer.from(secret, "hex");
  }
  return crypto.scryptSync(secret, "salt_smm", 32);
}

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
