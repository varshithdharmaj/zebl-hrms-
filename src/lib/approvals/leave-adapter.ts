import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/session";
import { getPendingApprovalsForActor } from "@/lib/workflow/pending-approvals";
import { getApproverRoleLabel } from "@/lib/workflow/approver-role-labels";
import {
  advanceWorkflow,
  rejectWorkflow,
  toWorkflowActor,
  WorkflowError,
} from "@/lib/workflow/leave-workflow";
import { getEscalationSlaHours } from "@/lib/workflow/workflow-sla";
import type {
  ApprovalActPayload,
  ApprovalActResult,
  ApprovalAdapter,
  ApprovalCase,
} from "@/lib/approvals/types";
import { parseLeaveCaseId, toLeaveCaseId } from "@/lib/approvals/types";

function leaveTypeLabel(leaveType: string): string {
  return LEAVE_TYPE_LABELS[leaveType as LeaveType] ?? leaveType;
}

function slaDueAt(submittedAt: Date | null, escalationHours: number): Date | null {
  if (!submittedAt) return null;
  return new Date(submittedAt.getTime() + escalationHours * 60 * 60 * 1000);
}

/**
 * Maps a pending leave request (from getPendingApprovalsForActor) into ApprovalCase.
 */
export function mapLeaveToApprovalCase(
  leave: {
    id: number;
    leaveType: string;
    days: number;
    startDate: Date;
    endDate: Date;
    employeeId: number;
    submittedAt: Date | null;
    version: number;
    employee?: { name: string } | null;
    currentStep?: { approverRole: string } | null;
    approvalSteps?: Array<{ id: number; approverRole: string }>;
    currentStepId?: number | null;
  },
  escalationHours: number
): ApprovalCase {
  const current =
    leave.currentStep ??
    leave.approvalSteps?.find((s) => s.id === leave.currentStepId) ??
    null;

  const employeeName = leave.employee?.name ?? `Employee #${leave.employeeId}`;
  const typeLabel = leaveTypeLabel(leave.leaveType);

  return {
    caseId: toLeaveCaseId(leave.id),
    caseType: "leave",
    title: `${typeLabel} · ${formatLeaveDaysSafe(leave.days)}`,
    subtitle: `${employeeName} · ${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`,
    subjectEmployeeId: leave.employeeId,
    status: "pending",
    priority: null,
    slaDueAt: slaDueAt(leave.submittedAt, escalationHours),
    submittedAt: leave.submittedAt,
    stepLabel: current ? getApproverRoleLabel(current.approverRole) : "Approval",
    actions: ["approve", "reject", "view"],
    deepLink: `/employee/approvals?case=${toLeaveCaseId(leave.id)}`,
    version: leave.version,
  };
}

function formatLeaveDaysSafe(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

async function listPendingLeaveCases(session: SessionUser): Promise<ApprovalCase[]> {
  const [leaves, escalationHours] = await Promise.all([
    getPendingApprovalsForActor(session),
    getEscalationSlaHours(),
  ]);
  return leaves.map((leave) => mapLeaveToApprovalCase(leave, escalationHours));
}

async function actOnLeaveCase(
  session: SessionUser,
  caseId: string,
  payload: ApprovalActPayload
): Promise<ApprovalActResult> {
  const leaveId = parseLeaveCaseId(caseId);
  if (leaveId == null) {
    return { error: "Invalid leave approval case." };
  }

  const actor = toWorkflowActor(session);

  try {
    if (payload.action === "approve") {
      const result = await advanceWorkflow(leaveId, actor, payload.version);
      return { success: result.message };
    }
    if (payload.action === "reject") {
      const comment = payload.comment?.trim() ?? "";
      const result = await rejectWorkflow(leaveId, actor, comment, payload.version);
      return { success: result.message };
    }
    if (payload.action === "view") {
      return { success: "OK" };
    }
    return { error: "Unsupported action." };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Action failed.";
    return { error: message };
  }
}

export const LeaveApprovalAdapter: ApprovalAdapter = {
  caseType: "leave",
  listPending: listPendingLeaveCases,
  act: actOnLeaveCase,
};
