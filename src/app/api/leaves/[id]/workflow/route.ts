import { NextResponse } from "next/server";
import {
  apiError,
  apiUnauthorized,
  requireApiSession,
} from "@/lib/api/leave-api";
import { getLeaveWorkflowDto } from "@/lib/workflow/leave-workflow";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, canApproveLeave } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireApiSession();
    if (!session) return apiUnauthorized();

    const { id: idStr } = await params;
    const leaveId = parseInt(idStr, 10);
    if (Number.isNaN(leaveId)) {
      return NextResponse.json({ error: "Invalid leave id" }, { status: 400 });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      select: { employeeId: true },
    });
    if (!leave) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const canView =
      session.employeeId === leave.employeeId ||
      canAccessAdmin(session.role) ||
      canApproveLeave(session.role);

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dto = await getLeaveWorkflowDto(leaveId);
    if (!dto) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ workflow: dto });
  } catch (e) {
    return apiError(e);
  }
}
