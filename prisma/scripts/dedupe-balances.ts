import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`DELETE FROM employee_leave_balances WHERE id NOT IN (
    SELECT MIN(id) FROM employee_leave_balances GROUP BY employee_id
  )`);
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM employee_leave_balances`);
  console.log("After dedupe:", rows);
}

main().finally(() => prisma.$disconnect());
