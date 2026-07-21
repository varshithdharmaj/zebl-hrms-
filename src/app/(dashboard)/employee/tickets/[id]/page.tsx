import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { TicketDetail } from "@/components/employee/ticket-detail";
import { TicketAuditHistory } from "@/components/tickets/ticket-audit-history";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { getTicketAuditHistory } from "@/lib/audit/ticket-audit";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      raisedByEmployee: {
        select: { id: true, name: true, employeeCode: true },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          employee: { select: { name: true } },
        },
      },
      messages: {
        where: {
          OR: [
            { visibility: "public_update" },
            { visibility: "employee_reply" },
          ],
        },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              employee: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Return 404 for missing or unauthorized (hides existence)
  if (!ticket || !canViewTicket(session, ticket)) {
    notFound();
  }

  // Fetch audit history (employees can see their own ticket history)
  const auditLogs = await getTicketAuditHistory(ticket.id, session);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={`Ticket ${ticket.ticketNumber}`}
        description={ticket.subject}
      />

      <TicketDetail ticket={ticket} session={session} />
      
      <TicketAuditHistory
        auditLogs={auditLogs}
        isAnonymous={ticket.isAnonymous}
        isSuperAdmin={false}
      />
    </div>
  );
}
