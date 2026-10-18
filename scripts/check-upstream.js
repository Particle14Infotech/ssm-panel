const { PrismaClient } = require("@prisma/client");
const { decryptProviderKey } = require("./apps/api/dist/src/common/crypto.util");

async function checkProvider() {
  const prisma = new PrismaClient();
  const provider = await prisma.provider.findFirst({
    where: { name: "cheapestsmmpanels" }
  });

  if (!provider) {
    console.log("No provider found!");
    return;
  }

  const apiKey = decryptProviderKey(provider.apiKeyEncrypted);
  console.log("Decrypted provider key successfully. Key length:", apiKey.length);

  // 1. Check Balance
  console.log("\n--- Checking Balance ---");
  const balanceRes = await fetch(provider.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "balance" }).toString()
  });
  console.log("Balance status:", balanceRes.status);
  const balanceData = await balanceRes.json();
  console.log("Balance response:", JSON.stringify(balanceData, null, 2));

  // 2. Check Services list and specifically service 6285
  console.log("\n--- Checking Services ---");
  const servicesRes = await fetch(provider.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }).toString()
  });
  console.log("Services status:", servicesRes.status);
  const services = await servicesRes.json();
  console.log("Total services returned from provider:", Array.isArray(services) ? services.length : "NOT AN ARRAY");

  if (Array.isArray(services)) {
    const s6285 = services.find(s => String(s.service) === "6285");
    console.log("Service 6285 details:", JSON.stringify(s6285, null, 2));

    // Also check if any service rates would overflow Decimal(10,2)
    let overflowCount = 0;
    for (const s of services) {
      const rate = parseFloat(s.rate);
      if (rate >= 10000000) {
        overflowCount++;
        console.log("High rate service:", s.service, s.name, s.rate);
      }
    }
    console.log("Services with rate >= 10^7:", overflowCount);
  }

  await prisma.$disconnect();
}

checkProvider().catch(console.error);
