import type {
  ApprovalStepStatus,
  ApproverRole,
  LeaveWorkflowStatus,
} from "@/generated/prisma/enums";
import type { LeaveBalanceSummary } from "@/lib/leave";
import type { LeaveOverlapWarning } from "@/lib/leave/leave-overlap";

/** Rich leave row for the Approval Center inbox UI (leave-only). */
export type PendingApprovalItem = {
  leave: {
    id: number;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    days: number;
    reason: string;
    workflowStatus: LeaveWorkflowStatus;
    version: number;
    employeeName: string;
    employeeId: number;
    department: string | null;
    submittedAt: Date | null;
    rejectionReason: string | null;
    currentStepId: number | null;
    steps: {
      id: number;
      stepOrder: number;
      approverRole: ApproverRole;
      approverId: number | null;
      approverName: string | null;
      status: ApprovalStepStatus;
      actedAt: Date | null;
      comment: string | null;
    }[];
  };
  balances: LeaveBalanceSummary[];
  recentLeaves: {
    id: number;
    leaveType: string;
    days: number;
    workflowStatus: LeaveWorkflowStatus;
    startDate: Date;
    endDate: Date;
  }[];
  overlapWarnings: LeaveOverlapWarning[];
  sla: {
    label: string;
    overdue: boolean;
    percentElapsed: number;
  };
};
