import { NextResponse } from "next/server";
import {
  apiError,
  apiUnauthorized,
  requireApiSession,
} from "@/lib/api/leave-api";
import { canApproveLeave } from "@/lib/permissions";
import {
  advanceWorkflow,
  toWorkflowActor,
} from "@/lib/workflow/leave-workflow";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiSession();
    if (!session) return apiUnauthorized();
    if (!canApproveLeave(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await params;
    const leaveId = parseInt(idStr, 10);
    if (Number.isNaN(leaveId)) {
      return NextResponse.json({ error: "Invalid leave id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { version?: number };
    const result = await advanceWorkflow(
      leaveId,
      toWorkflowActor(session),
      body.version
    );

    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
