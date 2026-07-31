import { ApproverRole } from "@/generated/prisma/enums";
import { getManager } from "@/lib/org";
import { getApproverRoleLabel } from "@/lib/workflow/approver-role-labels";

export { getApproverRoleLabel };
import type { ApprovalChainStepInput } from "@/lib/workflow/workflow-types";

/**
 * Resolves the Team Lead's manager (Department Head / next-level manager).
 * Team Lead = employee.managerId; Department Head = teamLead.managerId.
 */
export async function getSkipLevelManager(employeeId: number): Promise<number | null> {
  const teamLead = await getManager(employeeId);
  if (!teamLead) return null;
  const departmentHead = await getManager(teamLead.id);
  return departmentHead?.id ?? null;
}

export type BuildChainParams = {
  employeeId: number;
  /** @deprecated Unused — chain no longer depends on leave duration. Kept for call-site BC. */
  leaveDays?: number;
};

/**
 * Builds ordered approval chain:
 * Team Lead (manager) → Department Head (skip_level_manager, when present) → HR.
 * Missing / inactive Team Lead → HR only. Missing / inactive Department Head → Team Lead → HR.
 * Active-manager resolution is enforced by getManager() (isActive filter).
 */
export async function buildApprovalChain(
  params: BuildChainParams
): Promise<ApprovalChainStepInput[]> {
  const { employeeId } = params;
  const chain: ApprovalChainStepInput[] = [];
  let order = 1;

  const teamLeadId = (await getManager(employeeId))?.id ?? null;

  if (teamLeadId) {
    chain.push({
      stepOrder: order++,
      approverId: teamLeadId,
      approverRole: ApproverRole.manager,
    });

    const departmentHeadId = await getSkipLevelManager(employeeId);
    if (departmentHeadId && departmentHeadId !== teamLeadId) {
      chain.push({
        stepOrder: order++,
        approverId: departmentHeadId,
        approverRole: ApproverRole.skip_level_manager,
      });
    }
  }

  chain.push({
    stepOrder: order,
    approverId: null,
    approverRole: ApproverRole.hr_admin,
  });

  return chain;
}
