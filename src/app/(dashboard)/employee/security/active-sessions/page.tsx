import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ActiveSessionsTable } from "@/components/security/active-sessions-table";
import { SectionCard } from "@/components/ui/section-card";
import { requireEmployeeSession } from "@/lib/auth-guards";
import { getLoginHistory } from "@/lib/security/login-history-service";

export default async function EmployeeActiveSessionsPage() {
  const session = await requireEmployeeSession();
  const result = await getLoginHistory(
    { page: 1, pageSize: 100 },
    { employeeId: session.employeeId, activeOnly: true }
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Active Sessions"
        description="Review and revoke devices currently signed in to your account."
      />
      <SectionCard title="Your devices" description={`${result.total} active sessions`} noPadding>
        <div className="p-4 sm:p-5">
          <ActiveSessionsTable
            rows={result.rows}
            currentSessionId={session.sessionId}
            mode="employee"
          />
        </div>
      </SectionCard>
    </div>
  );
}
