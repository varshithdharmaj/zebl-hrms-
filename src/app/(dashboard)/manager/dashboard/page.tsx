import { redirect } from "next/navigation";
import { ManagerDashboardView } from "@/components/manager/manager-dashboard-view";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getSession } from "@/lib/auth";
import { getManagerDashboardStats } from "@/lib/queries";

export default async function ManagerDashboardPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const stats = await getManagerDashboardStats(session.employeeId);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Manager dashboard"
        description="Team overview and approval queue (workflow coming in a later phase)"
      />
      <ManagerDashboardView
        directReportsCount={stats.directReportsCount}
        pendingApprovalsCount={stats.pendingApprovalsCount}
      />
    </div>
  );
}
