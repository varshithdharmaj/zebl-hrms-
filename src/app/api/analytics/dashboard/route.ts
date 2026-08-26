import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewOrgAnalytics } from "@/lib/permissions";
import { getLatestExecutiveSnapshot } from "@/lib/analytics/analytics-engine";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session || !canViewOrgAnalytics(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getLatestExecutiveSnapshot();
  if (!snapshot) {
    return NextResponse.json(
      { error: "No analytics snapshot. Run analytics processing first." },
      { status: 404 }
    );
  }

  await writeAuditLog({
    entityType: "analytics",
    entityId: "executive_dashboard",
    action: AUDIT_ACTIONS.ANALYTICS_DASHBOARD_VIEWED,
    actorUserId: session.id,
    actorEmail: session.email,
  });

  return NextResponse.json(snapshot);
}
