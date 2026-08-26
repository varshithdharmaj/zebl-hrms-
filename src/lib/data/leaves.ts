import type { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries } from "@/lib/leave";

export async function getEmployeeLeavePageData(employeeId: number) {
  const [balances, leaves] = await Promise.all([
    getLeaveBalanceSummaries(employeeId, { processAccruals: true }),
    getLeaveRequests("employee", employeeId),
  ]);

  return { balances, leaves };
}

export async function getLeaveRequests(
  scope: "admin" | "employee",
  employeeId?: number,
  filters?: { workflowStatus?: string; q?: string }
) {
  const where = {
    ...(scope === "employee" && employeeId ? { employeeId } : {}),
    ...(filters?.workflowStatus
      ? { workflowStatus: filters.workflowStatus as LeaveWorkflowStatus }
      : {}),
    ...(filters?.q
      ? {
          OR: [
            { reason: { contains: filters.q, mode: "insensitive" as const } },
            { employee: { name: { contains: filters.q, mode: "insensitive" as const } } },
            { employee: { employeeCode: { contains: filters.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  return prisma.leaveRequest.findMany({
    where,
    include: {
      employee: true,
      approvalSteps: {
        orderBy: { stepOrder: "asc" },
        include: { approver: true },
      },
      currentStep: { include: { approver: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
