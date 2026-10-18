const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      wallet: {
        select: {
          balance: true
        }
      }
    }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  // Check the specific order: 6ad6ccfa-5667-45a6-b1d1-bde1a61706df
  const specificOrder = await prisma.order.findUnique({
    where: { id: "6ad6ccfa-5667-45a6-b1d1-bde1a61706df" },
    include: {
      service: true,
      provider: true,
      user: { select: { id: true, email: true, role: true } },
      history: true
    }
  });
  console.log("SPECIFIC ORDER DETAILS:", JSON.stringify(specificOrder, null, 2));

  // Check Outbox status for this order
  const outbox = await prisma.outboxEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });
  console.log("RECENT OUTBOX EVENTS:", JSON.stringify(outbox, null, 2));

  // Check providers
  const providers = await prisma.provider.findMany();
  console.log("PROVIDERS:", JSON.stringify(providers.map(p => ({
    id: p.id,
    name: p.name,
    apiUrl: p.apiUrl,
    balance: p.balance,
    currency: p.currency,
    active: p.active
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
