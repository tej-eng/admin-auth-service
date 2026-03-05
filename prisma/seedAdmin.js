import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {

  const existing = await prisma.admin.findUnique({
    where: { email: "admin@dhwaniastro.com" },
  });

  if (existing) {
    console.log("Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("123456", 10);

  let role = await prisma.role.findUnique({
    where: { name: "SUPER_ADMIN" },
  });

  if (!role) {
    role = await prisma.role.create({
      data: { name: "SUPER_ADMIN" },
    });
  }

  await prisma.admin.create({
    data: {
      name: "Super Admin",
      email: "admin@dhwaniastro.com",
      phoneNo: "9999999999",
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
    },
  });

  console.log("Super Admin created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());