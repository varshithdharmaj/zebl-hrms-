import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { isSuperAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import type { AuditLogRow } from "@/lib/audit/audit-queries";

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Get audit history for a specific ticket.
 * Enforces authorization: only users who can view the ticket can view its audit history.
 * For anonymous tickets, only Super Admin can view audit history.
 */
export async function getTicketAuditHistory(
  ticketId: string,
  session: SessionUser | null
): Promise<AuditLogRow[]> {
  if (!session) {
    return [];
  }

  // First, fetch the ticket to check authorization
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isAnonymous: true,
      raisedByEmployeeId: true,
      assignedToUserId: true,
      department: true,
    },
  });

  if (!ticket) {
    return [];
  }

  // Check if user can view this ticket
  if (!canViewTicket(session, ticket)) {
    return [];
  }

  // For anonymous tickets, only Super Admin can view audit history
  if (ticket.isAnonymous && !isSuperAdmin(session.role)) {
    return [];
  }

  // Fetch audit logs for this ticket
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "ticket",
      entityId: ticketId,
    },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    actorUserId: log.actorUserId,
    actorEmail: log.actorEmail,
    metadata: parseMetadata(log.metadata),
    createdAt: log.createdAt,
  }));
}

/**
 * Check if a user can view audit history for a ticket.
 * Same authorization rules as viewing the ticket itself.
 */
export async function canViewTicketAuditHistory(
  ticketId: string,
  session: SessionUser | null
): Promise<boolean> {
  if (!session) {
    return false;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      isAnonymous: true,
      raisedByEmployeeId: true,
      assignedToUserId: true,
      department: true,
    },
  });

  if (!ticket) {
    return false;
  }

  if (!canViewTicket(session, ticket)) {
    return false;
  }

  // Anonymous ticket audit history is Super Admin only
  if (ticket.isAnonymous && !isSuperAdmin(session.role)) {
    return false;
  }

  return true;
}

/**
 * Format audit action for display.
 */
export function formatAuditAction(action: string): string {
  return action
    .replace(/^ticket\./, "")
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get audit summary for ticket (last few key events).
 */
export async function getTicketAuditSummary(
  ticketId: string,
  session: SessionUser | null,
  limit = 5
): Promise<AuditLogRow[]> {
  const history = await getTicketAuditHistory(ticketId, session);
  return history.slice(0, limit);
}
