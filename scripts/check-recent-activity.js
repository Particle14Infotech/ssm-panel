const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function r() {
  const orders = await p.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: true, service: true }
  });
  console.log("=== RECENT ORDERS ===");
  for (const o of orders) {
    console.log(`[Order] ID: ${o.id} | User: ${o.user?.email} | Status: ${o.status} | Target: ${o.target} | Service: ${o.service?.name} | Created: ${o.createdAt}`);
  }

  const tickets = await p.ticket.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: true }
  });
  console.log("\n=== RECENT TICKETS ===");
  for (const t of tickets) {
    console.log(`[Ticket] ID: ${t.id} | User: ${t.user?.email} | Subject: ${t.subject} | Status: ${t.status} | Created: ${t.createdAt}`);
  }
  await p.$disconnect();
}
r().catch(console.error);
