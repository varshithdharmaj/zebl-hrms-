import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canApproveLeave } from "@/lib/permissions";
import { buildApprovalInsights } from "@/lib/analytics/approval-insights";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canApproveLeave(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leaveId = parseInt(new URL(request.url).searchParams.get("leaveId") ?? "", 10);
  if (Number.isNaN(leaveId)) {
    return NextResponse.json({ error: "Invalid leaveId" }, { status: 400 });
  }

  const insights = await buildApprovalInsights(leaveId);
  if (!insights) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 });
  }

  return NextResponse.json(insights);
}
