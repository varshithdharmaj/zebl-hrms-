const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allEmployees = await prisma.employee.findMany();
  
  const toDelete = allEmployees.filter(emp => {
    const code = (emp.employeeCode || '').toLowerCase();
    const name = (emp.name || '').toLowerCase();
    
    // keep if name is john doe or managet test hr
    if (name === 'john doe' || name === 'managet test hr') {
      return false; // keep
    }
    
    // keep if code contains only numbers
    if (/^\d+$/.test(code)) {
      return false; // keep
    }
    
    // remove employees whose code contains demo,emp
    if (code.includes('demo') || code.includes('emp')) {
      return true; // remove
    }
    
    return false;
  });
  
  console.log(`Found ${toDelete.length} employees to delete.`);
  
  let successCount = 0;
  for (const emp of toDelete) {
    try {
      await prisma.employee.delete({
        where: { id: emp.id }
      });
      successCount++;
    } catch (err) {
      console.log(`Failed to delete employee ${emp.employeeCode} - ${err.message}`);
    }
  }
  
  console.log(`Successfully deleted ${successCount} employees.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
