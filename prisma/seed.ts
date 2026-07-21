import { PrismaClient, UserRole, AuthProvider } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedJohnDoeMonth } from "./seed-john-doe";

const prisma = new PrismaClient();

// Super Admin is intentionally NOT seeded here — provision it via
// `npm run db:bootstrap-admin` (INITIAL_SUPER_ADMIN_EMAIL / INITIAL_SUPER_ADMIN_PASSWORD).
// Seeding it unconditionally here would make Super Admin creation implicit and unaudited.
async function main() {
  const hrPasswordHash = await bcrypt.hash("Hr@2026", 10);
  const employeePasswordHash = await bcrypt.hash("Employee@2026", 10);

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
      password: hrPasswordHash,
      role: UserRole.hr,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
    },
    create: {
      email: "hr@zebl.com",
      password: hrPasswordHash,
      role: UserRole.hr,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
    },
  });

  const employee = await prisma.employee.findUnique({
    where: { employeeCode: "EMP-JDOE" },
    select: { id: true, name: true },
  });
  if (!employee || employee.name.toLowerCase() !== "john doe") {
    throw new Error(
      "John Doe (EMP-JDOE) does not exist. Seed aborted without creating a replacement employee."
    );
  }

  const employeeUser = await prisma.user.findFirst({
    where: { employeeId: employee.id },
    select: { id: true },
  });
  if (!employeeUser) {
    throw new Error("John Doe exists but has no linked User record. Seed aborted.");
  }

  await prisma.user.update({
    where: { id: employeeUser.id },
    data: {
      password: employeePasswordHash,
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
    },
  });

  await seedJohnDoeMonth(prisma);

  console.log("Seeded default HR: hr@zebl.com / Hr@2026");
  console.log("Updated existing John Doe login password to Employee@2026");
  console.log(
    "Super Admin NOT seeded — run `npm run db:bootstrap-admin` with INITIAL_SUPER_ADMIN_EMAIL/PASSWORD set."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
