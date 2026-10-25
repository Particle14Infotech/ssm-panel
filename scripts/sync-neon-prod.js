const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("==================================================================");
  console.log("▶ SYNCING PRISMA SCHEMA & PRODUCTION DATA TO NEON POSTGRESQL");
  console.log("==================================================================");

  // 1. Clean out any leftover test drill accounts if present
  console.log("\n[1/5] Ensuring no test/drill users exist...");
  try {
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: "q3_cnc_" } },
          { email: { startsWith: "qa_" } },
          { email: { startsWith: "drill_" } },
          { email: { contains: "@smm.dev" } },
        ],
      },
      select: { id: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    if (testUserIds.length > 0) {
      // Cascade delete relations for test users
      await prisma.ticketMessage.deleteMany({ where: { senderId: { in: testUserIds } } }).catch(() => {});
      await prisma.ticket.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.packageTrigger.deleteMany({ where: { package: { userId: { in: testUserIds } } } }).catch(() => {});
      await prisma.packageExecution.deleteMany({ where: { package: { userId: { in: testUserIds } } } }).catch(() => {});
      await prisma.packageRule.deleteMany({ where: { package: { userId: { in: testUserIds } } } }).catch(() => {});
      await prisma.package.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.orderHistory.deleteMany({ where: { order: { userId: { in: testUserIds } } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: testUserIds } } } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.paymentOrder.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.apiToken.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: { in: testUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
      console.log(`  ✓ Cleaned up ${testUserIds.length} synthetic test user accounts.`);
    }
  } catch (err) {
    console.warn("  (Note: test users cleanup skipped:", err.message, ")");
  }

  // 2. Categories
  console.log("\n[2/5] Syncing Categories...");
  const categories = [
    { id: "cat_ig", name: "Instagram Followers & Engagement", slug: "instagram-growth", sortOrder: 1 },
    { id: "cat_yt", name: "YouTube Growth & Watchtime", slug: "youtube-views", sortOrder: 2 },
    { id: "cat_tw", name: "Twitter / X Growth", slug: "twitter-growth", sortOrder: 3 },
    { id: "cat_tg", name: "Telegram Community & Views", slug: "telegram-growth", sortOrder: 4 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder },
      create: cat,
    });
    console.log(`  ✓ Category: ${cat.name} (${cat.id})`);
  }

  // 3. Services
  console.log("\n[3/5] Syncing Real Services...");
  const services = [
    {
      id: "1042",
      categoryId: "cat_ig",
      name: "Instagram High-Retention Followers [Real Active • 0% Drop • 30D Refill]",
      platform: "INSTAGRAM",
      ratePer1000: 180.0,
      minQty: 100,
      maxQty: 500000,
      refillable: true,
      cancellable: true,
      packageEligible: true,
      linkType: "PROFILE",
      status: "ACTIVE",
    },
    {
      id: "1043",
      categoryId: "cat_ig",
      name: "Instagram High-Quality Likes [Fast Delivery • High Quality]",
      platform: "INSTAGRAM",
      ratePer1000: 65.0,
      minQty: 50,
      maxQty: 100000,
      refillable: false,
      cancellable: true,
      packageEligible: true,
      linkType: "POST_OR_REEL",
      status: "ACTIVE",
    },
    {
      id: "1044",
      categoryId: "cat_ig",
      name: "Instagram Highlights Views [Instant Delivery • Ultra Fast]",
      platform: "INSTAGRAM",
      ratePer1000: 150.97,
      minQty: 100,
      maxQty: 500000,
      refillable: false,
      cancellable: true,
      packageEligible: true,
      linkType: "POST_OR_REEL",
      status: "ACTIVE",
    },
    {
      id: "2015",
      categoryId: "cat_yt",
      name: "YouTube High Retention Views [Suggested Videos & Search Traffic]",
      platform: "YOUTUBE",
      ratePer1000: 160.0,
      minQty: 1000,
      maxQty: 10000000,
      refillable: true,
      cancellable: true,
      packageEligible: true,
      linkType: "POST_OR_REEL",
      status: "ACTIVE",
    },
    {
      id: "2016",
      categoryId: "cat_yt",
      name: "YouTube Subscribers [Non-Drop • Real Channels • Instant Start]",
      platform: "YOUTUBE",
      ratePer1000: 850.0,
      minQty: 100,
      maxQty: 50000,
      refillable: true,
      cancellable: true,
      linkType: "CHANNEL",
      status: "ACTIVE",
    },
    {
      id: "3001",
      categoryId: "cat_tw",
      name: "Twitter / X Worldwide Followers [Fast Speed • Stable]",
      platform: "TWITTER",
      ratePer1000: 320.0,
      minQty: 100,
      maxQty: 250000,
      refillable: true,
      cancellable: true,
      linkType: "PROFILE",
      status: "ACTIVE",
    },
    {
      id: "4001",
      categoryId: "cat_tg",
      name: "Telegram Channel Members [Global Accounts • 0% Drop]",
      platform: "TELEGRAM",
      ratePer1000: 120.0,
      minQty: 100,
      maxQty: 200000,
      refillable: true,
      cancellable: true,
      linkType: "PROFILE",
      status: "ACTIVE",
    },
    {
      id: "srv_mock_fail",
      categoryId: "cat_tw",
      name: "Mock Service 103 - Failure Drill Service",
      platform: "TWITTER",
      ratePer1000: 200.0,
      minQty: 100,
      maxQty: 100000,
      refillable: false,
      cancellable: true,
      packageEligible: true,
      linkType: "PROFILE",
      status: "ACTIVE",
    },
  ];

  for (const srv of services) {
    await prisma.service.upsert({
      where: { id: srv.id },
      update: srv,
      create: srv,
    });
    console.log(`  ✓ Service: #${srv.id} ${srv.name}`);
  }

  // 4. One Admin User Only
  console.log("\n[4/5] Syncing Single Admin User...");
  const adminEmail = "vaibhavrishabh40@gmail.com";
  const argonHash = "$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash";

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Vaibhav Kumar (Admin)",
      role: "ADMIN",
      tier: "ENTERPRISE",
      emailVerified: true,
      isDeleted: false,
    },
    create: {
      id: "usr_admin_master",
      email: adminEmail,
      name: "Vaibhav Kumar (Admin)",
      passwordHash: argonHash,
      role: "ADMIN",
      tier: "ENTERPRISE",
      emailVerified: true,
      isDeleted: false,
      wallet: {
        create: {
          balance: 100000.0,
          currency: "INR",
        },
      },
    },
    include: { wallet: true },
  });

  // Ensure Admin wallet & ledger
  if (adminUser.wallet) {
    await prisma.wallet.update({
      where: { id: adminUser.wallet.id },
      data: { balance: 100000.0 },
    });
    const existingAdminLedger = await prisma.ledgerEntry.findFirst({
      where: { walletId: adminUser.wallet.id },
    });
    if (!existingAdminLedger) {
      await prisma.ledgerEntry.create({
        data: {
          walletId: adminUser.wallet.id,
          type: "ADMIN_ADJUST",
          amount: 100000.0,
          description: "Admin Initial Capital Allocation",
        },
      });
    }
  }
  console.log(`  ✓ Admin: ${adminUser.name} <${adminUser.email}> (Role: ${adminUser.role}, Wallet: ₹1,00,000)`);

  // 5. Real User Only (Frontend previous customer)
  console.log("\n[5/5] Syncing Real Customer User (Bholu)...");
  const bholuEmail = "bholu@gmail.com";
  const bholuUser = await prisma.user.upsert({
    where: { email: bholuEmail },
    update: {
      name: "Bholu",
      role: "CUSTOMER",
      tier: "PRO_SCALE",
      emailVerified: true,
      isDeleted: false,
    },
    create: {
      id: "usr_bholu_customer",
      email: bholuEmail,
      name: "Bholu",
      passwordHash: argonHash,
      role: "CUSTOMER",
      tier: "PRO_SCALE",
      emailVerified: true,
      isDeleted: false,
      wallet: {
        create: {
          balance: 1068.61,
          currency: "INR",
        },
      },
    },
    include: { wallet: true },
  });

  if (bholuUser.wallet) {
    await prisma.wallet.update({
      where: { id: bholuUser.wallet.id },
      data: { balance: 1068.61 },
    });

    const existingBholuLedger = await prisma.ledgerEntry.findFirst({
      where: { walletId: bholuUser.wallet.id },
    });
    if (!existingBholuLedger) {
      // 1. Initial Deposit
      await prisma.ledgerEntry.create({
        data: {
          walletId: bholuUser.wallet.id,
          type: "DEPOSIT",
          amount: 2447.36,
          description: "Wallet Deposit + Bonus Credit",
        },
      });
      // 2. Order 1 Charge
      await prisma.ledgerEntry.create({
        data: {
          walletId: bholuUser.wallet.id,
          type: "ORDER_CHARGE",
          amount: 252.0,
          orderId: "ord_bholu_001",
          description: "Order #ord_bholu_001 Charge",
        },
      });
      // 3. Order 2 Charge
      await prisma.ledgerEntry.create({
        data: {
          walletId: bholuUser.wallet.id,
          type: "ORDER_CHARGE",
          amount: 69.96,
          orderId: "ord_bholu_002",
          description: "Order #ord_bholu_002 Charge",
        },
      });
      // 4. Order 3 Charge
      await prisma.ledgerEntry.create({
        data: {
          walletId: bholuUser.wallet.id,
          type: "ORDER_CHARGE",
          amount: 1056.79,
          orderId: "ord_bholu_003",
          description: "Order #ord_bholu_003 Charge",
        },
      });
    }
  }

  // Bholu Real Orders
  const bholuOrders = [
    {
      id: "ord_bholu_001",
      userId: bholuUser.id,
      serviceId: "1042",
      target: "https://instagram.com/bholu_official",
      quantity: 1400,
      charge: 252.0,
      startCount: 4200,
      remains: 0,
      status: "COMPLETED",
      isDripFeed: false,
      totalQuantity: 1400,
    },
    {
      id: "ord_bholu_002",
      userId: bholuUser.id,
      serviceId: "1043",
      target: "https://instagram.com/p/DA_bholu_post1",
      quantity: 3500,
      charge: 69.96,
      startCount: 150,
      remains: 0,
      status: "COMPLETED",
      isDripFeed: false,
      totalQuantity: 3500,
    },
    {
      id: "ord_bholu_003",
      userId: bholuUser.id,
      serviceId: "1044",
      target: "https://instagram.com/stories/highlights/180293",
      quantity: 7000,
      charge: 1056.79,
      startCount: 890,
      remains: 2100,
      status: "PROCESSING",
      isDripFeed: true,
      runs: 7,
      intervalMinutes: 1440,
      quantityPerRun: 1000,
      totalQuantity: 7000,
    },
  ];

  for (const ord of bholuOrders) {
    await prisma.order.upsert({
      where: { id: ord.id },
      update: ord,
      create: ord,
    });
    console.log(`  ✓ Customer Order: #${ord.id} - ${ord.status} (Charge: ₹${ord.charge})`);
  }

  console.log(`  ✓ Customer: ${bholuUser.name} <${bholuUser.email}> (Role: ${bholuUser.role}, Balance: ₹1,068.61, Orders: 3)`);

  // Verification Summary
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, wallet: { select: { balance: true } } },
  });
  const servicesCount = await prisma.service.count();
  const categoriesCount = await prisma.category.count();
  const ordersCount = await prisma.order.count();
  const ledgersCount = await prisma.ledgerEntry.count();

  console.log("\n==================================================================");
  console.log("✅ NEON PRODUCTION SYNC COMPLETE & VERIFIED");
  console.log(`   Total Users: ${users.length}`);
  users.forEach((u) => console.log(`     - [${u.role}] ${u.name} <${u.email}> (Balance: ₹${u.wallet?.balance})`));
  console.log(`   Categories:  ${categoriesCount}`);
  console.log(`   Services:    ${servicesCount}`);
  console.log(`   Orders:      ${ordersCount}`);
  console.log(`   Ledger Rows: ${ledgersCount}`);
  console.log("==================================================================");
}

main()
  .catch((e) => {
    console.error("Sync error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
