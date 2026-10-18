const crypto = require("crypto");
function mask(u) {
  if (!u) return "NOT_SET";
  try {
    const p = new URL(u);
    const h = crypto.createHash("sha256").update(p.host + p.pathname).digest("hex").slice(0, 12);
    return `${p.protocol}//${p.hostname.slice(0, 4)}***:${p.port || "def"}${p.pathname.slice(0, 4)}*** [hash:${h}]`;
  } catch (e) {
    return "INVALID";
  }
}
console.log(JSON.stringify({
  service: process.env.RAILWAY_SERVICE_NAME || "worker",
  db: mask(process.env.DATABASE_URL),
  redis: mask(process.env.REDIS_URL),
  hasProviderKeySecret: Boolean(process.env.PROVIDER_KEY_SECRET),
  hasProviderKeyEncKey: Boolean(process.env.PROVIDER_KEY_ENCRYPTION_KEY)
}, null, 2));
