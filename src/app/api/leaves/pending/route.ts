import { NextResponse } from "next/server";
import {
  apiError,
  apiUnauthorized,
  requireApiSession,
} from "@/lib/api/leave-api";
import { canAccessAdmin } from "@/lib/permissions";
import {
  enrichPendingLeaveRows,
  getPendingApprovalsForActor,
} from "@/lib/workflow/pending-approvals";
import { getLeaveWorkflowDto } from "@/lib/workflow/leave-workflow";

export async function GET() {
  try {
    const session = await requireApiSession();
    if (!session) return apiUnauthorized();
    // HR/Super Admin or a linked employee (line-manager). Results are hierarchy-scoped
    // by getPendingApprovalsForActor (empty for non-approvers).
    if (!canAccessAdmin(session.role) && session.employeeId == null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const leaves = await getPendingApprovalsForActor(session);
    const enriched = await enrichPendingLeaveRows(leaves);

    return NextResponse.json({
      items: await Promise.all(
        enriched.map(async ({ leave, balances, recentLeaves }) => ({
          leave: await getLeaveWorkflowDto(leave.id),
          balances,
          recentLeaves,
        }))
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
