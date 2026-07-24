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
  type TicketLike,
} from "./ticket-permissions";

export {
  buildTicketWhereClause,
  buildAnonymousTicketWhereClause,
  buildTicketCountWhere,
  getAdminTicketListSelect,
  type TicketFilters,
} from "./ticket-access";

// Do NOT re-export admin-ticket-list-data from this barrel.
// It imports prisma ("server-only") and would break client components that import
// permissions/labels from "@/lib/tickets". Import from:
//   "@/lib/tickets/admin-ticket-list-data"
// in Server Components / tests only.

export { CATEGORY_LABELS, PRIORITY_COLORS } from "./labels";

export {
  ticketListSearchParamsFromFilters,
  ticketListSearchParamsAfterSelectChange,
  ticketListSearchParamsAfterSearch,
  ticketListHref,
  type TicketListFilterState,
  type TicketListSelectFilterKey,
} from "./filter-params";
