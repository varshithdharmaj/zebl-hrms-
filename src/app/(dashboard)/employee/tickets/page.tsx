import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Headset } from "lucide-react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EmployeeTicketList } from "@/components/employee/employee-ticket-list";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTicketWhereClause } from "@/lib/tickets";

export default async function EmployeeTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  // Pagination
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const [tickets, totalCount] = await Promise.all([
    prisma.ticket.findMany({
      where: buildTicketWhereClause(session),
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
        updatedAt: true,
        createdAt: true,
        messages: {
          where: { visibility: "public_update" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            body: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.ticket.count({ where: buildTicketWhereClause(session) }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="My Tickets"
        description="View and manage your helpdesk tickets."
      />

      <div className="flex justify-end">
        <Button asChild>
          <Link href="/employee/tickets/new">
            <Plus className="mr-2 h-4 w-4" />
            Raise a Ticket
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={Headset}
          title="No tickets yet"
          description="You haven't raised any tickets. Need help? Create your first ticket to get started."
          action={
            <Button asChild>
              <Link href="/employee/tickets/new">
                <Plus className="mr-2 h-4 w-4" />
                Raise a Ticket
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <EmployeeTicketList tickets={tickets} />
          
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {page > 1 && (
                <Link
                  href={`/employee/tickets?page=${page - 1}`}
                  className="px-4 py-2 text-sm bg-background border rounded-md hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              <span className="px-4 py-2 text-sm">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/employee/tickets?page=${page + 1}`}
                  className="px-4 py-2 text-sm bg-background border rounded-md hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
