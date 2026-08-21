import { PrismaClient } from '../src/generated/prisma';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  const allEmployees = await prisma.employee.findMany();
  
  console.log(`Total employees in DB: ${allEmployees.length}`);
  
  const remainingDemoOrEmp = allEmployees.filter(emp => {
    const code = (emp.employeeCode || '').toLowerCase();
    return code.includes('demo') || code.includes('emp');
  });
  
  console.log(`Remaining employees with 'demo' or 'emp' in code: ${remainingDemoOrEmp.length}`);
  
  for (const emp of remainingDemoOrEmp) {
    console.log(`- Code: ${emp.employeeCode}, Name: ${emp.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
