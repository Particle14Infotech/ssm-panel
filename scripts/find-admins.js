const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, role: true }
  });
  console.log("Admins:", JSON.stringify(admins));
  await prisma.$disconnect();
}
main().catch(console.error);
