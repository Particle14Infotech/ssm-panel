const { PrismaClient } = require("@prisma/client");
const { decryptProviderKey } = require("./apps/api/dist/src/common/crypto.util");

async function testCheapestSmmPanels() {
  const prisma = new PrismaClient();
  const provider = await prisma.provider.findFirst({
    where: { name: "cheapestsmmpanels" }
  });
  const apiKey = decryptProviderKey(provider.apiKeyEncrypted);

  // Check what services exist for Instagram Likes (post likes)
  const servicesRes = await fetch(provider.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }).toString()
  });
  const services = await servicesRes.json();
  const igPostLikes = services.filter(s => 
    s.category && s.category.toLowerCase().includes("instagram likes") && s.type !== "Subscriptions"
  ).slice(0, 5);

  console.log("Top 5 non-subscription Instagram Likes services from provider:");
  for (const s of igPostLikes) {
    console.log(`- Service #${s.service}: [${s.category}] ${s.name} (type: ${s.type}, rate: ₹${s.rate}, min: ${s.min}, max: ${s.max})`);
  }

  // Also test what service 6285 expects if we do a dry run or check its type
  const s6285 = services.find(s => String(s.service) === "6285");
  console.log("\nService 6285 type:", s6285?.type, "category:", s6285?.category);

  await prisma.$disconnect();
}

testCheapestSmmPanels().catch(console.error);
