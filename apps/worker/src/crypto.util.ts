import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let ephemeralWorkerDevMasterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  const secret: string =
    process.env.ENCRYPTION_KEY ||
    "13c1aaa32c784aa4a6629239ff38ddd59975fddfba7505f7cd7dee72b83b2875";
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
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  const candidateSecrets = [
    process.env.ENCRYPTION_KEY,
    process.env.PROVIDER_KEY_ENCRYPTION_KEY,
    process.env.PROVIDER_KEY_SECRET,
    "13c1aaa32c784aa4a6629239ff38ddd59975fddfba7505f7cd7dee72b83b2875",
    "751b12539fb04d3926a0fbfe279b97de53d155440c774b4a975023dca1037f8c",
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;
  for (const secret of candidateSecrets) {
    try {
      const keyBuffer =
        secret.length === 64
          ? Buffer.from(secret, "hex")
          : crypto.scryptSync(secret, "salt_smm", 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(cipherBase64, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to decrypt provider key with any candidate secret.");
}
