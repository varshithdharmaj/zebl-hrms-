import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { HRTicketManagement } from "@/components/admin/hr-ticket-management";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { buildTicketCountWhere, buildTicketWhereClause } from "@/lib/tickets";
import { fetchAdminTicketListPageData } from "@/lib/tickets/admin-ticket-list-data";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string; q?: string; page?: string }>;
}) {
  // Shell access already gated by admin layout + middleware; shared guard for consistent session typing.
  const session = await requireHROrSuperAdminSession();

  const { status, category, priority, q, page: pageParam } = await searchParams;

  // Pagination
  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Build base where clause (automatically excludes anonymous for non-SA)
  const whereClause = buildTicketWhereClause(session, {
    status,
    category,
    priority,
    search: q,
  });

  // Unfiltered visibility scope for KPIs (excludes anonymous for non-SA)
  const statsWhere = buildTicketCountWhere(session);

  const { tickets, totalCount, stats, priorityStats } = await fetchAdminTicketListPageData({
    whereClause,
    statsWhere,
    skip,
    take: pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Helpdesk"
        description="Manage employee tickets and workplace concerns."
      />

      <HRTicketManagement
        tickets={tickets}
        stats={stats}
        priorityStats={priorityStats}
        initialFilters={{
          status: status ?? "",
          category: category ?? "",
          priority: priority ?? "",
          search: q ?? "",
        }}
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
        }}
      />
    </div>
  );
}
