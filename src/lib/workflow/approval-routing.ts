import { ApproverRole } from "@/generated/prisma/enums";
import { getManager } from "@/lib/org";
import { getApproverRoleLabel } from "@/lib/workflow/approver-role-labels";

export { getApproverRoleLabel };
import type { ApprovalChainStepInput } from "@/lib/workflow/workflow-types";
import { LONG_LEAVE_THRESHOLD_DAYS } from "@/lib/workflow/workflow-types";

export async function getSkipLevelManager(employeeId: number): Promise<number | null> {
  const direct = await getManager(employeeId);
  if (!direct) return null;
  const skip = await getManager(direct.id);
  return skip?.id ?? null;
}

export type BuildChainParams = {
  employeeId: number;
  leaveDays: number;
};

/**
 * Builds ordered approval chain. Policy-ready: threshold and roles are configurable constants.
 */
export async function buildApprovalChain(
  params: BuildChainParams
): Promise<ApprovalChainStepInput[]> {
  const { employeeId, leaveDays } = params;
  const chain: ApprovalChainStepInput[] = [];
  let order = 1;

  const directManagerId = (await getManager(employeeId))?.id ?? null;
  const isLongLeave = leaveDays >= LONG_LEAVE_THRESHOLD_DAYS;

  if (directManagerId) {
    chain.push({
      stepOrder: order++,
      approverId: directManagerId,
      approverRole: ApproverRole.manager,
    });

    if (isLongLeave) {
      const skipId = await getSkipLevelManager(employeeId);
      if (skipId && skipId !== directManagerId) {
        chain.push({
          stepOrder: order++,
          approverId: skipId,
          approverRole: ApproverRole.skip_level_manager,
        });
      }
    }
  }

  chain.push({
    stepOrder: order,
    approverId: null,
    approverRole: ApproverRole.hr_admin,
  });

  return chain;
}
