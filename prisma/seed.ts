import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Executing idempotent seed...");

  // 1. Categories
  const igCat = await prisma.category.upsert({
    where: { slug: "instagram-growth" },
    update: {},
    create: {
      id: "cat_ig",
      name: "Instagram Growth",
      slug: "instagram-growth",
      sortOrder: 1,
    },
  });

  const ytCat = await prisma.category.upsert({
    where: { slug: "youtube-views" },
    update: {},
    create: {
      id: "cat_yt",
      name: "YouTube Views",
      slug: "youtube-views",
      sortOrder: 2,
    },
  });

  // 2. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@smm-panel.io" },
    update: {},
    create: {
      id: "usr_admin_001",
      email: "admin@smm-panel.io",
      name: "System Administrator",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash",
      role: "ADMIN",
      tier: "ENTERPRISE",
      wallet: {
        create: {
          balance: 100000.0,
          currency: "INR",
        },
      },
    },
  });

  // 3. Customer User
  const customerUser = await prisma.user.upsert({
    where: { email: "alex.vance@smm-panel.io" },
    update: {},
    create: {
      id: "usr_998124smm",
      email: "alex.vance@smm-panel.io",
      name: "Alex Vance",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash",
      role: "CUSTOMER",
      tier: "PRO_SCALE",
      wallet: {
        create: {
          balance: 0.0,
          currency: "INR",
        },
      },
    },
  });

  // 3b. Customer User: Bholu (Restored)
  const bholuUser = await prisma.user.upsert({
    where: { email: "bholu@gmail.com" },
    update: {
      name: "Bholu",
      role: "CUSTOMER",
      tier: "PRO_SCALE",
    },
    create: {
      id: "usr_bholu_customer",
      email: "bholu@gmail.com",
      name: "Bholu",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash",
      role: "CUSTOMER",
      tier: "PRO_SCALE",
      wallet: {
        create: {
          balance: 1068.61,
          currency: "INR",
        },
      },
    },
    include: { wallet: true },
  });

  // Ensure Bholu wallet balance is restored if wallet already existed
  if (bholuUser.wallet) {
    await prisma.wallet.update({
      where: { id: bholuUser.wallet.id },
      data: { balance: 1068.61 },
    });
  }

  // 4. Reseller User
  const resellerUser = await prisma.user.upsert({
    where: { email: "reseller@smm-panel.io" },
    update: {},
    create: {
      id: "usr_reseller_001",
      email: "reseller@smm-panel.io",
      name: "Apex Reseller",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash",
      role: "RESELLER",
      apiKeyHash: "hash_of_aeth_live_reseller_key",
      wallet: {
        create: {
          balance: 50000.0,
          currency: "INR",
        },
      },
    },
  });

  // 5. Default Services
  await prisma.service.upsert({
    where: { id: "1042" },
    update: {},
    create: {
      id: "1042",
      categoryId: igCat.id,
      name: "Instagram High-Retention Followers [Real Active • 0% Drop • 30D Refill]",
      platform: "INSTAGRAM",
      ratePer1000: 180.0,
      minQty: 100,
      maxQty: 500000,
      refillable: true,
      cancellable: true,
      status: "ACTIVE",
    },
  });

  await prisma.service.upsert({
    where: { id: "2015" },
    update: {},
    create: {
      id: "2015",
      categoryId: ytCat.id,
      name: "YouTube High Retention Views [Suggested Videos & Search Traffic]",
      platform: "YOUTUBE",
      ratePer1000: 160.0,
      minQty: 1000,
      maxQty: 10000000,
      refillable: true,
      cancellable: true,
      status: "ACTIVE",
    },
  const igLikes = await prisma.service.upsert({
    where: { id: "1043" },
    update: {},
    create: {
      id: "1043",
      categoryId: igCat.id,
      name: "Instagram Likes [Speed 50k/D • High Quality • Instant]",
      platform: "INSTAGRAM",
      ratePer1000: 19.99,
      minQty: 50,
      maxQty: 100000,
      refillable: false,
      cancellable: true,
      status: "ACTIVE",
    },
  });

  const igViews = await prisma.service.upsert({
    where: { id: "1044" },
    update: {},
    create: {
      id: "1044",
      categoryId: igCat.id,
      name: "Instagram Highlights Views [Instant Delivery • Ultra Fast]",
      platform: "INSTAGRAM",
      ratePer1000: 150.97,
      minQty: 100,
      maxQty: 500000,
      refillable: false,
      cancellable: true,
      status: "ACTIVE",
    },
  });

  // 6. Restored Orders for Bholu (bholu@gmail.com)
  await prisma.order.upsert({
    where: { id: "ord_bholu_001" },
    update: {
      status: "COMPLETED",
      remains: 0,
    },
    create: {
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
  });

  await prisma.order.upsert({
    where: { id: "ord_bholu_002" },
    update: {
      status: "COMPLETED",
      remains: 0,
    },
    create: {
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
  });

  await prisma.order.upsert({
    where: { id: "ord_bholu_003" },
    update: {
      status: "PROCESSING",
      remains: 2100,
    },
    create: {
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
  });

  console.log("✅ Seed completed successfully with Bholu restored account and orders.");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
