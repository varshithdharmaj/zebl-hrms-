import { PrismaClient, UserRole, AuthProvider } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Hr@2026", 10);

  await prisma.integrationSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  await prisma.payrollSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "hr@zebl.com" },
    update: {
      password: passwordHash,
      role: UserRole.admin,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
    },
    create: {
      email: "hr@zebl.com",
      password: passwordHash,
      role: UserRole.admin,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
    },
  });

  console.log("Seeded default admin: hr@zebl.com / Hr@2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
