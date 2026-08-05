import { registerApprovalAdapter, getApprovalAdapter, parseCaseType } from "@/lib/approvals/registry";
import { LeaveApprovalAdapter } from "@/lib/approvals/leave-adapter";
import type { ApprovalActPayload, ApprovalActResult, ApprovalCase } from "@/lib/approvals/types";
import type { SessionUser } from "@/lib/session";
import {
  enrichPendingLeaveRows,
  getPendingApprovalsForActor,
} from "@/lib/workflow/pending-approvals";
import { getLeaveWorkflowDto } from "@/lib/workflow/leave-workflow";
import { getLeaveOverlapWarnings } from "@/lib/leave/leave-overlap";
import { computeSlaState, getEscalationSlaHours } from "@/lib/workflow/workflow-sla";
import type { PendingApprovalItem } from "@/lib/approvals/leave-inbox-types";

let registered = false;

/** Ensures Leave adapter is registered (idempotent). */
export function ensureApprovalCenterRegistered(): void {
  if (registered) return;
  registerApprovalAdapter(LeaveApprovalAdapter);
  registered = true;
}

/** Test helper to allow re-registration after registry clear. */
export function resetApprovalCenterRegistrationForTests(): void {
  registered = false;
}

/**
 * Lists pending Approval Center cases for the actor.
 * V1: leave adapter only. Optional caseType filter.
 */
export async function listApprovalCenterCases(
  session: SessionUser,
  caseType?: "leave"
): Promise<ApprovalCase[]> {
  ensureApprovalCenterRegistered();

  if (caseType && caseType !== "leave") {
    return [];
  }

  const adapter = getApprovalAdapter("leave");
  if (!adapter) return [];
  return adapter.listPending(session);
}

/**
 * Dispatches an approval action to the registered adapter for the case type.
 * Leave authorization remains inside the leave workflow (canUserApproveStep).
 */
export async function actOnApprovalCase(
  session: SessionUser,
  caseId: string,
  payload: ApprovalActPayload
): Promise<ApprovalActResult> {
  ensureApprovalCenterRegistered();

  const caseType = parseCaseType(caseId);
  if (!caseType) {
    return { error: "Unknown approval case." };
  }

  const adapter = getApprovalAdapter(caseType);
  if (!adapter) {
    return { error: `No approval adapter registered for ${caseType}.` };
  }

  return adapter.act(session, caseId, payload);
}

/**
 * Rich leave inbox rows for the existing Approval Center UI.
 * Reuses pending-approvals / workflow DTO / SLA helpers unchanged.
 */
export async function listLeaveApprovalInboxItems(
  session: SessionUser
): Promise<PendingApprovalItem[]> {
  const [leaves, slaHours] = await Promise.all([
    getPendingApprovalsForActor(session),
    getEscalationSlaHours(),
  ]);
  const enriched = await enrichPendingLeaveRows(leaves);

  const items = await Promise.all(
    enriched.map(async ({ leave, balances, recentLeaves }) => {
      const dto = await getLeaveWorkflowDto(leave.id);
      if (!dto) return null;

      const overlapWarnings = await getLeaveOverlapWarnings({
        leaveRequestId: leave.id,
        employeeId: leave.employeeId,
        department: leave.employee.department,
        startDate: leave.startDate,
        endDate: leave.endDate,
      });

      const sla = computeSlaState(dto.submittedAt, slaHours);

      const item: PendingApprovalItem = {
        leave: {
          id: dto.id,
          leaveType: dto.leaveType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          days: dto.days,
          reason: dto.reason,
          workflowStatus: dto.workflowStatus,
          version: dto.version,
          employeeName: dto.employeeName,
          employeeId: dto.employeeId,
          department: leave.employee.department,
          submittedAt: dto.submittedAt,
          rejectionReason: dto.rejectionReason,
          currentStepId: dto.currentStep?.id ?? null,
          steps: dto.steps,
        },
        balances,
        recentLeaves,
        overlapWarnings,
        sla,
      };
      return item;
    })
  );

  return items.filter((i): i is PendingApprovalItem => i !== null);
}
