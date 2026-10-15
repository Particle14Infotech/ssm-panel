import { encryptProviderKey, decryptProviderKey } from "./crypto.util";

describe("AES-256-GCM Provider Key Encryption (SRS §30, §36, §53)", () => {
  it("encrypts and decrypts secret key accurately", () => {
    const rawApiKey = "sk_live_apex_smm_ultra_secret_key_99812";
    const encrypted = encryptProviderKey(rawApiKey);

    expect(encrypted).not.toEqual(rawApiKey);
    expect(encrypted.split(":").length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decryptProviderKey(encrypted);
    expect(decrypted).toBe(rawApiKey);
  });

  it("fails to decrypt if ciphertext is tampered with", () => {
    const rawApiKey = "sk_live_provider_key_12345";
    const encrypted = encryptProviderKey(rawApiKey);
    const parts = encrypted.split(":");
    const tampered = `${parts[0]}:${parts[1]}:badcipher`;

    expect(() => decryptProviderKey(tampered)).toThrow();
  });

  it("fails to decrypt if auth tag is tampered with", () => {
    const rawApiKey = "sk_live_provider_key_12345";
    const encrypted = encryptProviderKey(rawApiKey);
    const parts = encrypted.split(":");
    const fakeTag = Buffer.alloc(16).toString("base64");
    const tampered = `${parts[0]}:${fakeTag}:${parts[2]}`;

    expect(() => decryptProviderKey(tampered)).toThrow();
  });
});
