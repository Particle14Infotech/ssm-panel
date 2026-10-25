const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function clean() {
  const users = await prisma.user.findMany({
    where: {
      email: { notIn: ["vaibhavrishabh40@gmail.com", "bholu@gmail.com"] },
    },
    select: { id: true, email: true },
  });
  console.log(`Found ${users.length} test accounts to clean.`);
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  // 1. Support Tickets
  await prisma.ticketMessage.deleteMany({ where: { senderId: { in: ids } } }).catch(() => {});
  await prisma.ticket.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // 2. Packages
  await prisma.packageTrigger.deleteMany({ where: { package: { userId: { in: ids } } } }).catch(() => {});
  await prisma.packageExecution.deleteMany({ where: { package: { userId: { in: ids } } } }).catch(() => {});
  await prisma.packageRule.deleteMany({ where: { package: { userId: { in: ids } } } }).catch(() => {});
  await prisma.package.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // 3. Orders
  await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: ids } } } }).catch(() => {});
  await prisma.orderRun.deleteMany({ where: { order: { userId: { in: ids } } } }).catch(() => {});
  await prisma.orderProviderEvent.deleteMany({ where: { order: { userId: { in: ids } } } }).catch(() => {});
  await prisma.refund.deleteMany({ where: { order: { userId: { in: ids } } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // 4. Wallet & Payments
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: ids } } } }).catch(() => {});
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // 5. Auth & Preferences
  await prisma.session.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.favorite.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  // 6. Users
  const res = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Successfully deleted ${res.count} test users.`);

  const remaining = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true },
  });
  console.log("\nRemaining Production Users in Neon:");
  console.table(remaining);
}

clean()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
