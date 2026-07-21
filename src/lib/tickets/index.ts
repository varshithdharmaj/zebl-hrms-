/**
 * Ticket authorization and access control.
 * 
 * This module provides the authorization layer for the helpdesk/ticket system.
 * 
 * ## Security Model
 * 
 * Anonymous tickets are completely invisible to non-Super Admin users at the
 * query level. This is enforced by:
 * 
 * 1. `buildTicketWhereClause()` - Always adds `isAnonymous: false` for non-SA
 * 2. Permission checks - All helpers deny access to anonymous tickets for non-SA
 * 3. Separate anonymous queue - `buildAnonymousTicketWhereClause()` is SA-only
 * 
 * ## Usage
 * 
 * ```typescript
 * // In a server action or API route
 * import { getSession } from "@/lib/auth";
 * import { buildTicketWhereClause, canViewTicket } from "@/lib/tickets";
 * 
 * const session = await getSession();
 * if (!session) throw new Error("Unauthorized");
 * 
 * // List tickets
 * const tickets = await prisma.ticket.findMany({
 *   where: buildTicketWhereClause(session, { status: "open" })
 * });
 * 
 * // Check specific ticket
 * const ticket = await prisma.ticket.findUnique({ where: { id } });
 * if (!ticket || !canViewTicket(session, ticket)) {
 *   return { error: "Not found" }; // 404, never 403 (hides existence)
 * }
 * ```
 */

export {
  canViewTicket,
  canManageTicket,
  canReplyToTicket,
  canAddPublicUpdate,
  canAddInternalNote,
  canViewInternalNotes,
  canAssignTicket,
  canAccessAnonymousTickets,
  canCreateTicketForOthers,
  type TicketLike,
} from "./ticket-permissions";

export {
  buildTicketWhereClause,
  buildAnonymousTicketWhereClause,
  buildTicketCountWhere,
  getTicketSelectForSession,
  type TicketFilters,
} from "./ticket-access";
