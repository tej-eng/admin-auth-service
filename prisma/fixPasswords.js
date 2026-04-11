import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixPasswords() {
  const staffList = await prisma.staff.findMany();

  for (const s of staffList) {
    if (!s.password.startsWith("$2b$")) {
      const hashed = await bcrypt.hash(s.password, 10);

      await prisma.staff.update({
        where: { id: s.id },
        data: { password: hashed },
      });

      console.log(`Fixed password for: ${s.email}`);
    }
  }
}

fixPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());