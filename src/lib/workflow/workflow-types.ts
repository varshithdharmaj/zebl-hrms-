import type {
  ApprovalStepStatus,
  ApproverRole,
  LeaveApprovalStep,
  LeaveRequest,
  LeaveWorkflowStatus,
  Employee,
} from "@prisma/client";
import type { SessionUser } from "@/lib/session";

export type { ApprovalStepStatus, ApproverRole, LeaveWorkflowStatus };

export type ApprovalChainStepInput = {
  stepOrder: number;
  approverId: number | null;
  approverRole: ApproverRole;
};

export type LeaveWithSteps = LeaveRequest & {
  approvalSteps: (LeaveApprovalStep & { approver: Employee | null })[];
  employee: Employee;
  currentStep?: (LeaveApprovalStep & { approver: Employee | null }) | null;
};

export type WorkflowActor = {
  userId: string;
  email: string;
  role: SessionUser["role"];
  employeeId: number | null;
};

export type WorkflowActionResult = {
  leaveId: number;
  workflowStatus: LeaveWorkflowStatus;
  message: string;
};

export const MIN_REJECTION_COMMENT_LENGTH = 10;
export const MIN_CANCELLATION_REASON_LENGTH = 10;

/** Configurable — long leave triggers skip-level manager in chain */
export const LONG_LEAVE_THRESHOLD_DAYS = 5;
