const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function maskUrl(urlStr) {
  if (!urlStr) return "NOT SET";
  try {
    const parsed = new URL(urlStr);
    const hostHash = crypto.createHash("sha256").update(parsed.host).digest("hex").slice(0, 10);
    const pathnameHash = crypto.createHash("sha256").update(parsed.pathname).digest("hex").slice(0, 10);
    return `${parsed.protocol}//${parsed.hostname.slice(0, 4)}***:${parsed.port || 'default'}${parsed.pathname.slice(0, 4)}*** (HostHash: ${hostHash}, DbHash: ${pathnameHash})`;
  } catch (e) {
    return "INVALID_URL";
  }
}

async function run() {
  console.log("=== SERVICE FINGERPRINT ===");
  console.log("SERVICE_NAME:", process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || "unknown");
  console.log("DATABASE_URL FINGERPRINT:", maskUrl(process.env.DATABASE_URL));
  console.log("REDIS_URL FINGERPRINT:", maskUrl(process.env.REDIS_URL));
  console.log("FRONTEND_URL:", process.env.FRONTEND_URL || "NOT SET");

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log("Prisma connection: SUCCESS");

    // Search for order with Instagram link
    const targetLink = "https://www.instagram.com/p/DeBAAntkpNd/";
    const shortCode = "DeBAAntkpNd";
    console.log("\n=== STEP 2: TRACE THE USER ORDER ===");
    console.log("Searching for target link:", targetLink);

    const matchingOrders = await prisma.order.findMany({
      where: {
        OR: [
          { target: { contains: shortCode } },
          { target: { contains: "instagram" } }
        ]
      },
      include: {
        service: true,
        user: { select: { id: true, email: true, role: true } },
        refunds: true,
        history: true
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    console.log(`Found ${matchingOrders.length} matching order(s).`);
    for (const o of matchingOrders) {
      console.log(JSON.stringify({
        id: o.id,
        userId: o.userId,
        userEmail: o.user?.email,
        serviceId: o.serviceId,
        serviceName: o.service?.name,
        target: o.target,
        quantity: o.quantity,
        charge: o.charge ? o.charge.toString() : null,
        status: o.status,
        providerOrderId: o.providerOrderId,
        providerId: o.providerId,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt
      }, null, 2));

      // Ledger entries for this order or user
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          OR: [
            { referenceId: o.id },
            { description: { contains: o.id } }
          ]
        }
      });
      console.log(`Ledger entries for order #${o.id}:`, JSON.stringify(ledgerEntries, null, 2));

      // Outbox entries for this order
      const outboxEntries = await prisma.outboxEvent.findMany({
        where: {
          payload: {
            path: ["orderId"],
            equals: o.id
          }
        }
      });
      console.log(`Outbox events for order #${o.id}:`, JSON.stringify(outboxEntries, null, 2));
    }

    // Also check total orders count
    const totalOrders = await prisma.order.count();
    console.log("\nTotal orders in production DB:", totalOrders);

    // List recent 5 orders overall
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        target: true,
        status: true,
        createdAt: true
      }
    });
    console.log("Recent 5 orders in DB:", JSON.stringify(recentOrders, null, 2));

    // Check outbox stats
    const pendingOutbox = await prisma.outboxEvent.count({ where: { status: "PENDING" } });
    const failedOutbox = await prisma.outboxEvent.count({ where: { status: "FAILED" } });
    const completedOutbox = await prisma.outboxEvent.count({ where: { status: "PROCESSED" } });
    console.log("\n=== OUTBOX STATUS ===");
    console.log({ pendingOutbox, failedOutbox, completedOutbox });

    if (failedOutbox > 0) {
      const recentFailed = await prisma.outboxEvent.findMany({
        where: { status: "FAILED" },
        take: 3,
        orderBy: { updatedAt: "desc" }
      });
      console.log("Recent failed outbox events:", JSON.stringify(recentFailed, null, 2));
    }

    // Step 3: Provider check
    console.log("\n=== STEP 3: PROVIDER CHECK ===");
    const providers = await prisma.provider.findMany();
    console.log(`Found ${providers.length} provider(s):`);
    for (const p of providers) {
      console.log(JSON.stringify({
        id: p.id,
        name: p.name,
        apiUrl: p.apiUrl,
        hasKeyEncrypted: Boolean(p.apiKeyEncrypted),
        keyLength: p.apiKeyEncrypted ? p.apiKeyEncrypted.length : 0,
        balance: p.balance ? p.balance.toString() : null,
        currency: p.currency,
        active: p.active,
        updatedAt: p.updatedAt
      }, null, 2));
    }

  } catch (err) {
    console.error("Forensics error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
