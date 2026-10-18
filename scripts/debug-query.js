const { PrismaClient } = require("@prisma/client");

async function debugPrismaQuery() {
  const prisma = new PrismaClient();
  try {
    const requesterRole = "ADMIN";
    const where = {};
    const res = await prisma.order.findMany({
      where,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            platform: true,
            refillable: true,
            cancellable: true,
          },
        },
        history: {
          orderBy: { createdAt: "asc" },
        },
        refunds: true,
        provider: requesterRole === "ADMIN" ? { select: { id: true, name: true } } : false,
      },
      orderBy: { createdAt: "desc" },
    });
    console.log("Direct Prisma query result count:", res.length);
    console.log("First order:", JSON.stringify(res[0], null, 2));
  } catch (err) {
    console.error("Direct query error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

debugPrismaQuery();
