import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { HRTicketManagement } from "@/components/admin/hr-ticket-management";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildTicketWhereClause } from "@/lib/tickets";
import { canAccessHRAdministration } from "@/lib/permissions";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string; q?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessHRAdministration(session.role)) {
    redirect("/login");
  }

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

  const [tickets, totalCount, stats, hrUsers] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        isAnonymous: true,
        department: true,
        assignedToUserId: true,
        assignedToUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { name: true } },
          },
        },
        raisedByEmployee: {
          select: { name: true, employeeCode: true },
        },
        updatedAt: true,
        createdAt: true,
      },
    }),
    // Get total count for pagination
    prisma.ticket.count({ where: whereClause }),
    // Get stats (automatically excludes anonymous for non-SA)
    prisma.ticket.groupBy({
      by: ["status"],
      where: buildTicketWhereClause(session),
      _count: true,
    }),
    // Get HR users for assignment dropdown
    prisma.user.findMany({
      where: {
        role: { in: ["hr", "super_admin"] },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        employee: { select: { name: true } },
      },
      orderBy: { email: "asc" },
    }),
  ]);

  // Calculate priority stats
  const priorityStats = await prisma.ticket.groupBy({
    by: ["priority"],
    where: buildTicketWhereClause(session),
    _count: true,
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
        hrUsers={hrUsers}
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
