import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("employee_leave_balances")`
  );
  console.log("Columns:", cols.map((c) => c.name));
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM employee_leave_balances`);
  console.log("Rows:", rows);
}

main().finally(() => prisma.$disconnect());
