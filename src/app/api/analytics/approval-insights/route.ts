import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildApprovalInsights } from "@/lib/analytics/approval-insights";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leaveId = parseInt(new URL(request.url).searchParams.get("leaveId") ?? "", 10);
  if (Number.isNaN(leaveId)) {
    return NextResponse.json({ error: "Invalid leaveId" }, { status: 400 });
  }

  // HR/Super Admin, or the employee assigned as an approver on this specific leave.
  const isAssignedApprover =
    session.employeeId != null &&
    (await prisma.leaveApprovalStep.count({
      where: { leaveRequestId: leaveId, approverId: session.employeeId },
    })) > 0;

  if (!canAccessAdmin(session.role) && !isAssignedApprover) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insights = await buildApprovalInsights(leaveId);
  if (!insights) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }

  return NextResponse.json(insights);
}
