import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { HRTicketDetail } from "@/components/admin/hr-ticket-detail";
import { TicketAuditHistory } from "@/components/tickets/ticket-audit-history";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { isSuperAdmin } from "@/lib/permissions";
import { getTicketAuditHistory } from "@/lib/audit/ticket-audit";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Shell access already gated by admin layout + middleware; shared guard for consistent session typing.
  const session = await requireHROrSuperAdminSession();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      raisedByEmployee: {
        select: { id: true, name: true, employeeCode: true, department: true, email: true },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          employee: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: { select: { name: true } },
            },
          },
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
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

  if (ticket.isAnonymous && isSuperAdmin(session.role)) {
    await writeAuditLog({
      entityType: "ticket",
      entityId: ticket.id,
      action: AUDIT_ACTIONS.TICKET_ANONYMOUS_VIEWED,
      actorUserId: session.id,
      actorEmail: session.email,
      employeeId: session.employeeId,
      module: "helpdesk",
      description: "Super Admin viewed a restricted anonymous ticket.",
      requestContext: await getRequestSecurityContext(),
      metadata: { restricted: true },
    });
  }

  // Get HR users for assignment
  const hrUsers = await prisma.user.findMany({
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
  });

  // Fetch audit history
  const auditLogs = await getTicketAuditHistory(ticket.id, session);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={`Ticket ${ticket.ticketNumber}`}
        description={ticket.subject}
      />

      <HRTicketDetail ticket={ticket} session={session} hrUsers={hrUsers} />
      
      <TicketAuditHistory
        auditLogs={auditLogs}
        isAnonymous={ticket.isAnonymous}
        isSuperAdmin={isSuperAdmin(session.role)}
      />
    </div>
  );
}
