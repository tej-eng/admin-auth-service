import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // ================= DEPARTMENT =================
  const department = await prisma.department.upsert({
    where: { slug: "super-admin-department" },
    update: {},
    create: {
      name: "Super Admin Department",
      slug: "super-admin-department",
    },
  });

  // ================= MODULES =================
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

  // ================= PERMISSIONS =================
  const actions = ["create", "read", "update", "delete"];
  const modules = await prisma.module.findMany();

  for (const mod of modules) {
    for (const action of actions) {
      const name = `${mod.slug}.${action}`;

      const permission = await prisma.permission.upsert({
        where: { name },
        update: {},
        create: {
          name,
          type: "SYSTEM",
        },
      });

      const existingLink = await prisma.modulePermission.findFirst({
        where: {
          moduleId: mod.id,
          permissionId: permission.id,
        },
      });

      if (!existingLink) {
        await prisma.modulePermission.create({
          data: {
            moduleId: mod.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  // ================= SUPER ADMIN ROLE =================
  const superAdminRole = await prisma.role.upsert({
    where: { slug: "super-admin" },
    update: {},
    create: {
      name: "SUPER_ADMIN",
      slug: "super-admin",
    },
  });

  // ================= ASSIGN ALL PERMISSIONS =================
  const allPermissions = await prisma.permission.findMany();

  await prisma.rolePermission.createMany({
    data: allPermissions.map((perm) => ({
      roleId: superAdminRole.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });

  // ================= SUPER ADMIN STAFF =================
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
      roleId: superAdminRole.id,
      departmentId: department.id,
    },
  });

  console.log("Seed Done ✅ (Super Admin Created)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());