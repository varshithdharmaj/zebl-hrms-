import { ApprovalStepStatus, ApproverRole, LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { canAccessAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export async function getPendingApprovalsForActor(session: SessionUser) {
  if (canAccessAdmin(session.role)) {
    return getPendingHrApprovals();
  }

  if (session.role === "manager" && session.employeeId) {
    return getPendingManagerApprovals(session.employeeId);
  }

  return [];
}

async function getPendingManagerApprovals(managerEmployeeId: number) {
  const steps = await prisma.leaveApprovalStep.findMany({
    where: {
      approverId: managerEmployeeId,
      status: ApprovalStepStatus.pending,
      leaveRequest: {
        workflowStatus: LeaveWorkflowStatus.pending_approval,
        currentStepId: { not: null },
      },
    },
    include: {
      leaveRequest: {
        include: {
          employee: true,
          approvalSteps: { orderBy: { stepOrder: "asc" }, include: { approver: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return steps
    .filter((s) => s.leaveRequest.currentStepId === s.id)
    .map((s) => s.leaveRequest);
}

export async function getPendingHrApprovals() {
  const steps = await prisma.leaveApprovalStep.findMany({
    where: {
      approverRole: ApproverRole.hr_admin,
      status: ApprovalStepStatus.pending,
      leaveRequest: {
        workflowStatus: LeaveWorkflowStatus.pending_approval,
      },
    },
    include: {
      leaveRequest: {
        include: {
          employee: true,
          approvalSteps: { orderBy: { stepOrder: "asc" }, include: { approver: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return steps
    .filter((s) => s.leaveRequest.currentStepId === s.id)
    .map((s) => s.leaveRequest);
}

export async function enrichPendingLeaveRows(
  leaves: Awaited<ReturnType<typeof getPendingManagerApprovals>>
) {
  return Promise.all(
    leaves.map(async (leave) => {
      const balances = await getLeaveBalanceSummaries(leave.employeeId, {
        processAccruals: false,
      });
      const recentLeaves = await prisma.leaveRequest.findMany({
        where: { employeeId: leave.employeeId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          leaveType: true,
          days: true,
          workflowStatus: true,
          startDate: true,
          endDate: true,
        },
      });
      return { leave, balances, recentLeaves };
    })
  );
}
