import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ActiveSessionsTable } from "@/components/security/active-sessions-table";
import { SectionCard } from "@/components/ui/section-card";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { isSuperAdmin } from "@/lib/permissions";
import { getLoginHistory } from "@/lib/security/login-history-service";

export default async function AdminActiveSessionsPage() {
  const session = await requireHROrSuperAdminSession();
  const result = await getLoginHistory(
    { page: 1, pageSize: 100 },
    { activeOnly: true }
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Active Sessions"
        description="Monitor devices currently connected to ZEBL AMS."
      />
      <SectionCard title="Connected sessions" description={`${result.total} active sessions`} noPadding>
        <div className="p-4 sm:p-5">
          <ActiveSessionsTable
            rows={result.rows}
            currentSessionId={session.sessionId}
            mode="admin"
            canForceLogout={isSuperAdmin(session.role)}
          />
        </div>
      </SectionCard>
    </div>
  );
}
