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
  
  const toDelete = allEmployees.filter(emp => {
    const code = (emp.employeeCode || '').toUpperCase();
    
    // Match any single uppercase letter followed by numbers, e.g., B1784536639863, M1786333697394
    if (/^[A-Z]\d{5,}$/.test(code)) {
      return true; // remove
    }
    
    return false;
  });
  
  console.log(`Attempting to delete ${toDelete.length} employees with format Letter+Numbers...`);
  
  let successCount = 0;
  for (const emp of toDelete) {
    try {
      // Manually delete known restricting/failing relations
      await prisma.employeeConversionSnapshot.deleteMany({ where: { employeeId: emp.id } });
      await prisma.attendanceRecord.deleteMany({ where: { employeeId: emp.id } });
      await prisma.leaveTransaction.deleteMany({ where: { employeeId: emp.id } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: emp.id } });
      await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: emp.id } });
      await prisma.payrollAttendanceSummary.deleteMany({ where: { employeeId: emp.id } });
      
      // Candidate relations where employeeId is unique/optional
      await prisma.candidate.updateMany({
        where: { employeeId: emp.id },
        data: { employeeId: null }
      });
      await prisma.application.updateMany({
        where: { assignedManagerEmployeeId: emp.id },
        data: { assignedManagerEmployeeId: null }
      });

      // Hiring/Interview
      await prisma.hiringTeamMember.deleteMany({ where: { employeeId: emp.id } });
      await prisma.interviewPanelist.deleteMany({ where: { employeeId: emp.id } });
      await prisma.interviewFeedback.deleteMany({ where: { authorEmployeeId: emp.id } });
      
      // Finally delete employee
      await prisma.employee.delete({
        where: { id: emp.id }
      });
      successCount++;
    } catch (err) {
      console.log(`Failed to delete employee ${emp.employeeCode} - ${(err as Error).message}`);
    }
  }
  
  console.log(`Successfully deleted ${successCount} employees.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
