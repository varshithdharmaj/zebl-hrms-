/**
 * One-time: set password "123" for employee-role local logins.
 * Does NOT change Super Admin, HR, or John Doe (EMP-JDOE).
 *
 * Run: npx tsx prisma/scripts/reset-excel-employee-passwords.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, AuthProvider } from "../../src/generated/prisma/client";

/** Keep in sync with EXCEL_UPLOAD_DEFAULT_PASSWORD in account-lifecycle.ts */
const EXCEL_UPLOAD_DEFAULT_PASSWORD = "123";
const JOHN_DOE_CODE = "EMP-JDOE";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(EXCEL_UPLOAD_DEFAULT_PASSWORD, 10);

  const users = await prisma.user.findMany({
    where: {
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      employeeId: { not: null },
    },
    select: {
      id: true,
      email: true,
      employee: { select: { employeeCode: true, name: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const code = user.employee?.employeeCode ?? "";
    const name = (user.employee?.name ?? "").toLowerCase();

    if (code === JOHN_DOE_CODE || name === "john doe") {
      console.log(`SKIP John Doe: ${user.email}`);
      skipped += 1;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    });
    console.log(`OK ${user.email} (${code})`);
    updated += 1;
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}`);
  console.log("Unchanged: Super Admin, HR, John Doe.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
