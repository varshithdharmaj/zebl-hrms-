import { redirect } from "next/navigation";
import { ManagerApprovalInbox } from "@/components/manager/manager-approval-inbox";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getSession } from "@/lib/auth";
import {
  enrichPendingLeaveRows,
  getPendingApprovalsForActor,
} from "@/lib/workflow/pending-approvals";
import { getLeaveWorkflowDto } from "@/lib/workflow/leave-workflow";
import { getLeaveOverlapWarnings } from "@/lib/leave/leave-overlap";
import { computeSlaState, getEscalationSlaHours } from "@/lib/workflow/workflow-sla";

// Team leave approvals for line-managers. Access is derived from the Employee hierarchy
// (the signed-in user is the assigned approver on pending steps), not from an app role.
export default async function EmployeeApprovalsPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/employee/dashboard");

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

      return {
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
    })
  );

  const filtered = items.filter((i): i is NonNullable<typeof i> => i !== null);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Team approvals"
        description="Review and act on leave requests from your direct reports."
        badge={
          filtered.length > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-2 text-xs font-bold text-warning-foreground">
              {filtered.length}
            </span>
          ) : undefined
        }
      />
      <ManagerApprovalInbox items={filtered} />
    </div>
  );
}
