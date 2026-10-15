const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Executing idempotent database seed...');

  // 1. Categories
  const igCat = await prisma.category.upsert({
    where: { slug: 'instagram-growth' },
    update: {},
    create: {
      id: 'cat_ig',
      name: 'Instagram Growth',
      slug: 'instagram-growth',
      sortOrder: 1,
    },
  });

  const ytCat = await prisma.category.upsert({
    where: { slug: 'youtube-views' },
    update: {},
    create: {
      id: 'cat_yt',
      name: 'YouTube Views',
      slug: 'youtube-views',
      sortOrder: 2,
    },
  });

  // 2. Admin User
  await prisma.user.upsert({
    where: { email: 'admin@smm-panel.io' },
    update: {},
    create: {
      id: 'usr_admin_001',
      email: 'admin@smm-panel.io',
      name: 'System Administrator',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
      role: 'ADMIN',
      tier: 'ENTERPRISE',
      wallet: {
        create: {
          balance: 100000.0,
          currency: 'INR',
        },
      },
    },
  });

  // 3. Customer User
  await prisma.user.upsert({
    where: { email: 'alex.vance@smm-panel.io' },
    update: {},
    create: {
      id: 'usr_998124smm',
      email: 'alex.vance@smm-panel.io',
      name: 'Alex Vance',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
      role: 'CUSTOMER',
      tier: 'PRO_SCALE',
      wallet: {
        create: {
          balance: 2450.0,
          currency: 'INR',
        },
      },
    },
  });

  // 4. Default Services
  await prisma.service.upsert({
    where: { id: '1042' },
    update: {},
    create: {
      id: '1042',
      categoryId: igCat.id,
      name: 'Instagram High-Retention Followers [Real Active • 0% Drop • 30D Refill]',
      platform: 'INSTAGRAM',
      ratePer1000: 180.0,
      minQty: 100,
      maxQty: 500000,
      refillable: true,
      cancellable: true,
      status: 'ACTIVE',
    },
  });

  await prisma.service.upsert({
    where: { id: '2015' },
    update: {},
    create: {
      id: '2015',
      categoryId: ytCat.id,
      name: 'YouTube High Retention Views [Suggested Videos & Search Traffic]',
      platform: 'YOUTUBE',
      ratePer1000: 160.0,
      minQty: 1000,
      maxQty: 10000000,
      refillable: true,
      cancellable: true,
      status: 'ACTIVE',
    },
  });

  console.log('[seed] ✅ Database seeded successfully.');
}

main()
  .catch((err) => {
    console.error('[seed] Warning during seed:', err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
