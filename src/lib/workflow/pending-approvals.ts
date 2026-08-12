import { ApprovalStepStatus, ApproverRole, LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries } from "@/lib/leave";
import { canAccessAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

/** Minimal leave graph required by pending-approval consumers (inbox, adapter, command center). */
const pendingLeaveSelect = {
  id: true,
  leaveType: true,
  days: true,
  startDate: true,
  endDate: true,
  employeeId: true,
  submittedAt: true,
  version: true,
  currentStepId: true,
  workflowStatus: true,
  employee: {
    select: {
      name: true,
      department: true,
    },
  },
  approvalSteps: {
    orderBy: { stepOrder: "asc" as const },
    select: {
      id: true,
      approverRole: true,
      status: true,
      stepOrder: true,
    },
  },
} as const;

export async function getPendingApprovalsForActor(session: SessionUser) {
  if (canAccessAdmin(session.role)) {
    return getPendingHrApprovals();
  }

  // Team Lead / Department Head capability is hierarchy-based (approverId), not UserRole.
  if (session.employeeId) {
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
    select: {
      id: true,
      leaveRequest: { select: pendingLeaveSelect },
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
    select: {
      id: true,
      leaveRequest: { select: pendingLeaveSelect },
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
        processAccruals: true,
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
