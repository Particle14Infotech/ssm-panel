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

  // 2. Admin User from Environment
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@smmpanel.internal').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisAdminPasswordNow!';
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
    },
    create: {
      email: adminEmail,
      name: 'System Administrator',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
      role: 'ADMIN',
      tier: 'ENTERPRISE',
      wallet: {
        create: {
          balance: 0,
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

  // 5. DEV-ONLY QA Accounts & MockProvider
  if (process.env.NODE_ENV !== 'production') {
    // Customer A: Rs 1,000 balance
    await prisma.user.upsert({
      where: { email: 'customer_a@smm.dev' },
      update: {
        role: 'CUSTOMER',
      },
      create: {
        id: 'usr_cust_a',
        email: 'customer_a@smm.dev',
        name: 'Customer A',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
        role: 'CUSTOMER',
        tier: 'STARTER',
        wallet: { create: { balance: 1000.0, currency: 'INR' } },
      },
    });

    // Customer B: Rs 0 balance
    await prisma.user.upsert({
      where: { email: 'customer_b@smm.dev' },
      update: {
        role: 'CUSTOMER',
      },
      create: {
        id: 'usr_cust_b',
        email: 'customer_b@smm.dev',
        name: 'Customer B',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$demo_hash',
        role: 'CUSTOMER',
        tier: 'STARTER',
        wallet: { create: { balance: 0.0, currency: 'INR' } },
      },
    });

    // MockProvider with 3 services
    const mockProvider = await prisma.provider.upsert({
      where: { id: 'prov_mock' },
      update: {
        apiUrl: 'simulated://mock.provider/api/v2',
        active: true,
      },
      create: {
        id: 'prov_mock',
        name: 'MockProvider',
        apiUrl: 'simulated://mock.provider/api/v2',
        apiKeyEncrypted: 'mock_encrypted_key',
        currency: 'INR',
        balance: 25000.0,
        active: true,
      },
    });

    // 1. Refill-enabled service
    await prisma.service.upsert({
      where: { id: 'srv_mock_refill' },
      update: {
        providerId: mockProvider.id,
        providerServiceId: '101',
        refillable: true,
        cancellable: false,
      },
      create: {
        id: 'srv_mock_refill',
        categoryId: ytCat.id,
        name: 'Mock Service 101 - Refill Enabled',
        platform: 'YOUTUBE',
        ratePer1000: 120.0,
        minQty: 100,
        maxQty: 500000,
        refillable: true,
        cancellable: false,
        status: 'ACTIVE',
        providerId: mockProvider.id,
        providerServiceId: '101',
      },
    });

    // 2. Cancel-enabled service
    await prisma.service.upsert({
      where: { id: 'srv_mock_cancel' },
      update: {
        providerId: mockProvider.id,
        providerServiceId: '102',
        refillable: false,
        cancellable: true,
      },
      create: {
        id: 'srv_mock_cancel',
        categoryId: igCat.id,
        name: 'Mock Service 102 - Cancel Enabled',
        platform: 'INSTAGRAM',
        ratePer1000: 150.0,
        minQty: 50,
        maxQty: 100000,
        refillable: false,
        cancellable: true,
        status: 'ACTIVE',
        providerId: mockProvider.id,
        providerServiceId: '102',
      },
    });

    // 3. Fails on demand service
    await prisma.service.upsert({
      where: { id: 'srv_mock_fail' },
      update: {
        providerId: mockProvider.id,
        providerServiceId: '103',
        refillable: false,
        cancellable: false,
      },
      create: {
        id: 'srv_mock_fail',
        categoryId: igCat.id,
        name: 'Mock Service 103 - Fails on Demand',
        platform: 'INSTAGRAM',
        ratePer1000: 99.0,
        minQty: 10,
        maxQty: 1000,
        refillable: false,
        cancellable: false,
        status: 'ACTIVE',
        providerId: mockProvider.id,
        providerServiceId: '103',
      },
    });
  }

  console.log('[seed] [OK] Database seeded successfully.');
}

main()
  .catch((err) => {
    console.error('[seed] Warning during seed:', err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
