const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const user = await p.user.update({
    where: { email: "vaibhavrishabh40@gmail.com" },
    data: { role: "ADMIN" }
  });
  console.log("Updated user role to ADMIN:", user.email, user.role);
  await p.$disconnect();
}
main().catch(console.error);
