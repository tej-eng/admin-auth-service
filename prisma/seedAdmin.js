import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // ================= ROLE =================
  const role = await prisma.role.upsert({
    where: { slug: "super-admin" },
    update: {},
    create: {
      name: "SUPER_ADMIN",
      slug: "super-admin",
    },
  });

  // ================= DEPARTMENT =================
  const department = await prisma.department.upsert({
    where: { slug: "admin-department" },
    update: {},
    create: {
      name: "Admin Department",
      slug: "admin-department",
    },
  });

 
  const modulesData = [
    { name: "Roles", slug: "roles", section: "privilege" },
    { name: "Permissions", slug: "permissions", section: "privilege" },
    { name: "Modules", slug: "modules", section: "privilege" },
    { name: "Departments", slug: "departments", section: "privilege" },
    { name: "Staff", slug: "staff", section: "privilege" },
  ];

  for (const mod of modulesData) {
    await prisma.module.upsert({
      where: { slug: mod.slug },
      update: {},
      create: mod,
    });
  }


  const actions = ["create", "read", "update", "delete"];
  const modules = await prisma.module.findMany();

  for (const mod of modules) {
    for (const action of actions) {
      const name = `${mod.slug}.${action}`;

      await prisma.permission.upsert({
        where: { name },
        update: {},
        create: {
          name,
          type: "SYSTEM",
          modules: {
            create: {
              module: { connect: { id: mod.id } },
            },
          },
        },
      });
    }
  }


  const allPermissions = await prisma.permission.findMany();


  await prisma.rolePermission.createMany({
    data: allPermissions.map((perm) => ({
      roleId: role.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });


  const hashedPassword = await bcrypt.hash("123456", 10);

  await prisma.staff.upsert({
    where: { email: "admin@dhwaniastro.com" },
    update: {
      password: hashedPassword,
    },
    create: {
      name: "Super Admin",
      email: "admin@dhwaniastro.com",
      password: hashedPassword,
      roleId: role.id,
      departmentId: department.id,
    },
  });

  console.log("Seed Done ✅");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());