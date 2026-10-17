const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getMasterKey() {
  const secret = process.env.PROVIDER_KEY_ENCRYPTION_KEY || process.env.PROVIDER_KEY_SECRET;
  if (!secret) {
    return crypto.scryptSync("smm_master_provider_key_fallback_dev", "salt_smm", 32);
  }
  if (secret.length === 64) {
    return Buffer.from(secret, "hex");
  }
  return crypto.scryptSync(secret, "salt_smm", 32);
}

function encryptProviderKey(plainKey) {
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

async function configureProvider() {
  const name = process.env.PROVIDER_NAME || "cheapestsmmpanels";
  const apiUrl = process.env.PROVIDER_API_URL || "https://cheapestsmmpanels.com/api/v2";
  const apiKey = process.env.PROVIDER_API_KEY || "e69190fdf34d3a2dcb81ea5c6d0d64ff";

  console.log(`[Config] Configuring Upstream Provider '${name}'...`);

  const encryptedKey = encryptProviderKey(apiKey.trim());

  const existing = await prisma.provider.findFirst({
    where: {
      OR: [
        { name },
        { apiUrl }
      ]
    }
  });

  if (existing) {
    const updated = await prisma.provider.update({
      where: { id: existing.id },
      data: {
        name,
        apiUrl,
        apiKeyEncrypted: encryptedKey,
        currency: "INR",
        active: true,
      }
    });
    console.log(`[Config] ✅ Provider updated successfully: #${updated.id} (${updated.name})`);
  } else {
    const created = await prisma.provider.create({
      data: {
        name,
        apiUrl,
        apiKeyEncrypted: encryptedKey,
        currency: "INR",
        balance: 123.06,
        active: true,
      }
    });
    console.log(`[Config] ✅ Provider created successfully: #${created.id} (${created.name})`);
  }
}

configureProvider()
  .catch(err => {
    console.log("[Config] Database notice:", err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
