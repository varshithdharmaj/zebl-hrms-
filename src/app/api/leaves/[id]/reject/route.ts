import { NextResponse } from "next/server";
import {
  apiError,
  apiUnauthorized,
  requireApiSession,
} from "@/lib/api/leave-api";
import { canAccessAdmin } from "@/lib/permissions";
import {
  rejectWorkflow,
  toWorkflowActor,
} from "@/lib/workflow/leave-workflow";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiSession();
    if (!session) return apiUnauthorized();
    // Coarse gate: HR/Super Admin or a linked employee (potential approver). Per-step
    // authorization is enforced by canUserApproveStep inside rejectWorkflow.
    if (!canAccessAdmin(session.role) && session.employeeId == null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await params;
    const leaveId = parseInt(idStr, 10);
    if (Number.isNaN(leaveId)) {
      return NextResponse.json({ error: "Invalid leave id" }, { status: 400 });
    }

    const body = (await request.json()) as { comment?: string; version?: number };
    if (!body.comment?.trim()) {
      return NextResponse.json({ error: "Rejection comment is required." }, { status: 400 });
    }

    const result = await rejectWorkflow(
      leaveId,
      toWorkflowActor(session),
      body.comment,
      body.version
    );

    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
