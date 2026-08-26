import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AdminAuditView } from "@/components/admin/admin-audit-view";
import { getAuditFilterOptions, searchAuditLogs } from "@/lib/audit/audit-queries";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entityType?: string;
    action?: string;
    actorEmail?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [{ rows, total, pageSize }, filterOptions] = await Promise.all([
    searchAuditLogs({
      q: params.q,
      entityType: params.entityType,
      action: params.action,
      actorEmail: params.actorEmail,
      page,
    }),
    getAuditFilterOptions(),
  ]);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Audit log"
        description="Search workflow, authentication, and notification activity across the system."
      />
      <AdminAuditView
        logs={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        filters={{
          q: params.q,
          entityType: params.entityType,
          action: params.action,
          actorEmail: params.actorEmail,
        }}
        filterOptions={filterOptions}
      />
    </div>
  );
}
