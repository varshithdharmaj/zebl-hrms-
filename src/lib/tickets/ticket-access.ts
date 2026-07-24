import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/permissions";

export type TicketFilters = {
  status?: string | string[];
  priority?: string | string[];
  category?: string | string[];
  assignedToUserId?: string;
  search?: string;
};

/**
 * Build the WHERE clause for tickets visible to the given session user.
 * 
 * CRITICAL: This is the single source of truth for anonymous ticket filtering.
 * All ticket queries MUST use this function to ensure anonymous tickets are
 * never exposed to non-Super Admin users.
 * 
 * Rules:
 * - Super Admin: all tickets (including anonymous)
 * - HR: assigned + department-matched, NON-ANONYMOUS only
 * - Employee: own tickets only (by raisedByEmployeeId)
 * - Anonymous tickets never visible to non-SA
 */
export function buildTicketWhereClause(
  session: SessionUser,
  filters?: TicketFilters
): Prisma.TicketWhereInput {
  const baseWhere: Prisma.TicketWhereInput = {};

  // Apply user filters
  if (filters?.status) {
    baseWhere.status = Array.isArray(filters.status)
      ? { in: filters.status as unknown as never[] }
      : (filters.status as unknown as never);
  }
  if (filters?.priority) {
    baseWhere.priority = Array.isArray(filters.priority)
      ? { in: filters.priority as unknown as never[] }
      : (filters.priority as unknown as never);
  }
  if (filters?.category) {
    baseWhere.category = Array.isArray(filters.category)
      ? { in: filters.category as unknown as never[] }
      : (filters.category as unknown as never);
  }

  // Search must be combined with access scope via AND — never overwrite access OR.
  const searchOr: Prisma.TicketWhereInput[] | null = filters?.search
    ? [
        { ticketNumber: { contains: filters.search, mode: "insensitive" } },
        { subject: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ]
    : null;

  // Super Admin: all tickets (including anonymous)
  if (isSuperAdmin(session.role)) {
    if (searchOr) {
      baseWhere.OR = searchOr;
    }
    return baseWhere;
  }

  // Non-SA: NEVER see anonymous tickets
  baseWhere.isAnonymous = false;

  // Employee: own tickets only
  if (session.role === "employee") {
    if (!session.employeeId) {
      // No employee profile = no tickets visible
      return { id: "impossible" };
    }
    baseWhere.raisedByEmployeeId = session.employeeId;
    if (searchOr) {
      baseWhere.OR = searchOr;
    }
    return baseWhere;
  }

  // HR: assigned or unassigned (non-anonymous already enforced above)
  if (session.role === "hr") {
    const hrConditions: Prisma.TicketWhereInput[] = [];

    // Assigned to this HR user
    if (filters?.assignedToUserId === session.id || !filters?.assignedToUserId) {
      hrConditions.push({ assignedToUserId: session.id });
    }

    // Unassigned tickets in HR scope (new tickets HR may pick up)
    hrConditions.push({ assignedToUserId: null });

    if (hrConditions.length === 0) {
      return { id: "impossible" };
    }

    // Preserve access scope AND search: never replace access OR with search OR
    if (searchOr) {
      return {
        ...baseWhere,
        AND: [{ OR: hrConditions }, { OR: searchOr }],
      };
    }

    baseWhere.OR = hrConditions;
    return baseWhere;
  }

  // Unknown role: no access
  return { id: "impossible" };
}

/**
 * Build WHERE clause specifically for anonymous tickets (Super Admin only).
 */
export function buildAnonymousTicketWhereClause(
  session: SessionUser,
  filters?: TicketFilters
): Prisma.TicketWhereInput {
  // Only Super Admin can access this
  if (!isSuperAdmin(session.role)) {
    return { id: "impossible" };
  }

  const where: Prisma.TicketWhereInput = {
    isAnonymous: true,
  };

  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status as unknown as never[] }
      : (filters.status as unknown as never);
  }
  if (filters?.priority) {
    where.priority = Array.isArray(filters.priority)
      ? { in: filters.priority as unknown as never[] }
      : (filters.priority as unknown as never);
  }
  if (filters?.category) {
    where.category = Array.isArray(filters.category)
      ? { in: filters.category as unknown as never[] }
      : (filters.category as unknown as never);
  }
  if (filters?.search) {
    where.OR = [
      { ticketNumber: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Get count of visible tickets for dashboard/stats (no list filters).
 * Anonymous tickets excluded for non-SA — same semantics as
 * `buildTicketWhereClause(session)` with no filters.
 */
export function buildTicketCountWhere(session: SessionUser): Prisma.TicketWhereInput {
  return buildTicketWhereClause(session);
}

/**
 * Shared Prisma select for admin ticket list pages
 * (`/admin/tickets` and `/admin/tickets/anonymous`).
 *
 * Authorization remains in the route WHERE clause — this is projection only.
 * Includes `raisedByEmployee.id` for both surfaces (HR UI ignores it).
 */
export function getAdminTicketListSelect() {
  return {
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
      select: { id: true, name: true, employeeCode: true },
    },
    updatedAt: true,
    createdAt: true,
  } as const satisfies Prisma.TicketSelect;
}
