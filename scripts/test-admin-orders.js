const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

async function testAdminOrders() {
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" }
  });
  console.log("Admin user:", admin ? { id: admin.id, email: admin.email, role: admin.role } : "None");

  // Generate an admin JWT with the JWT_SECRET from environment
  const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  console.log("Has JWT secret:", Boolean(jwtSecret));

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role },
    jwtSecret,
    { expiresIn: "1h" }
  );

  const res = await fetch("http://localhost:4000/api/v1/orders", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log("Fetch /api/v1/orders status:", res.status);
  const data = await res.json();
  console.log("Orders count returned by API:", Array.isArray(data) ? data.length : "NOT ARRAY", data);

  // Check what admin orders page in frontend expects
  if (Array.isArray(data)) {
    console.log("First order fields:", data[0]);
    const targetOrder = data.find(o => o.id === "6ad6ccfa-5667-45a6-b1d1-bde1a61706df");
    console.log("Is target order in list?", Boolean(targetOrder));
  }

  await prisma.$disconnect();
}

testAdminOrders().catch(console.error);
