import { prisma } from "@/lib/prisma";

export async function getManagerDashboardStats(managerEmployeeId: number) {
  const { ApprovalStepStatus, LeaveWorkflowStatus } = await import("@prisma/client");

  const [directReportsCount, pendingApprovalsCount] = await Promise.all([
    prisma.employee.count({ where: { managerId: managerEmployeeId } }),
    prisma.leaveApprovalStep.count({
      where: {
        approverId: managerEmployeeId,
        status: ApprovalStepStatus.pending,
        leaveRequest: {
          workflowStatus: LeaveWorkflowStatus.pending_approval,
          currentStepId: { not: null },
        },
      },
    }),
  ]);

  return {
    directReportsCount,
    pendingApprovalsCount,
  };
}
