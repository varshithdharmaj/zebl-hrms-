import type { Prisma } from "@prisma/client";
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
      ? { in: filters.status as any[] }
      : (filters.status as any);
  }
  if (filters?.priority) {
    baseWhere.priority = Array.isArray(filters.priority)
      ? { in: filters.priority as any[] }
      : (filters.priority as any);
  }
  if (filters?.category) {
    baseWhere.category = Array.isArray(filters.category)
      ? { in: filters.category as any[] }
      : (filters.category as any);
  }
  if (filters?.search) {
    baseWhere.OR = [
      { ticketNumber: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Super Admin: all tickets (including anonymous)
  if (isSuperAdmin(session.role)) {
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
    return baseWhere;
  }

  // HR: assigned or department-matched (non-anonymous already enforced above)
  if (session.role === "hr") {
    const hrConditions: Prisma.TicketWhereInput[] = [];

    // Assigned to this HR user
    if (filters?.assignedToUserId === session.id || !filters?.assignedToUserId) {
      hrConditions.push({ assignedToUserId: session.id });
    }

    // Department-matched (if HR user has employee profile)
    // Note: This is a simplified version. Full implementation would require
    // fetching the HR user's department from their employee record.
    // For now, we allow HR to see unassigned tickets in their scope.
    hrConditions.push({ assignedToUserId: null });

    if (hrConditions.length > 0) {
      baseWhere.OR = hrConditions;
    } else {
      // No conditions met = no tickets
      return { id: "impossible" };
    }

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
      ? { in: filters.status as any[] }
      : (filters.status as any);
  }
  if (filters?.priority) {
    where.priority = Array.isArray(filters.priority)
      ? { in: filters.priority as any[] }
      : (filters.priority as any);
  }
  if (filters?.category) {
    where.category = Array.isArray(filters.category)
      ? { in: filters.category as any[] }
      : (filters.category as any);
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
 * Get count of visible tickets for dashboard/stats.
 * Anonymous tickets excluded for non-SA.
 */
export function buildTicketCountWhere(session: SessionUser): Prisma.TicketWhereInput {
  return buildTicketWhereClause(session);
}

/**
 * Standard ticket select that hides employee identity for anonymous tickets
 * when viewed by non-Super Admin users.
 * 
 * NOTE: This is a defense-in-depth measure. The primary protection is the
 * WHERE clause that prevents non-SA from querying anonymous tickets at all.
 */
export function getTicketSelectForSession(session: SessionUser) {
  const isAdmin = isSuperAdmin(session.role);

  return {
    id: true,
    ticketNumber: true,
    subject: true,
    description: true,
    category: true,
    type: true,
    priority: true,
    status: true,
    isAnonymous: true,
    raisedByEmployeeId: isAdmin, // Hide employee ID from non-SA
    raisedByEmployee: isAdmin
      ? { select: { id: true, name: true, employeeCode: true, department: true } }
      : false,
    department: true,
    assignedToUserId: true,
    assignedToUser: {
      select: { id: true, email: true, employee: { select: { name: true } } },
    },
    resolutionNotes: true,
    resolvedAt: true,
    closedAt: true,
    createdAt: true,
    updatedAt: true,
  };
}
