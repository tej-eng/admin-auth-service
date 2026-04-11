import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {},
    create: {
      name: "SUPER_ADMIN",
      description: "System Super Admin"
    }
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Normal Admin"
    }
  });

  // Hash passwords
  const superPassword = await bcrypt.hash("superpassword", 10);
  const adminPassword = await bcrypt.hash("adminpassword", 10);

  // Create Super Admin
  await prisma.admin.upsert({
    where: { email: "super@test.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "super@test.com",
      phoneNo: "9999999990",
      password: superPassword,
      roleId: superAdminRole.id
    }
  });

  // Create Admin
  await prisma.admin.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@test.com",
      phoneNo: "9999999991",
      password: adminPassword,
      roleId: adminRole.id
    }
  });

  console.log("Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });