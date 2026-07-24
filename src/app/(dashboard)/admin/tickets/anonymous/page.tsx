import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SuperAdminAnonymousTickets } from "@/components/admin/superadmin-anonymous-tickets";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildAnonymousTicketWhereClause,
  getAdminTicketListSelect,
} from "@/lib/tickets";
import { canAccessAnonymousTickets } from "@/lib/permissions";

export default async function AnonymousTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string; q?: string }>;
}) {
  const session = await getSession();
  
  // Super Admin only - strict guard
  if (!session || !canAccessAnonymousTickets(session.role)) {
    redirect("/login");
  }

  const { status, category, priority, q } = await searchParams;

  // Build WHERE clause for anonymous tickets (Super Admin only)
  const whereClause = buildAnonymousTicketWhereClause(session, {
    status,
    category,
    priority,
    search: q,
  });

  const [tickets, stats] = await Promise.all([
    prisma.ticket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: getAdminTicketListSelect(),
    }),
    // Get stats for anonymous tickets only
    prisma.ticket.groupBy({
      by: ["status"],
      where: buildAnonymousTicketWhereClause(session),
      _count: true,
    }),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Anonymous Tickets"
        description="Super Admin only — View tickets submitted anonymously with employee identity."
      />

      <SuperAdminAnonymousTickets
        tickets={tickets}
        stats={stats}
        initialFilters={{
          status: status ?? "",
          category: category ?? "",
          priority: priority ?? "",
          search: q ?? "",
        }}
      />
    </div>
  );
}
