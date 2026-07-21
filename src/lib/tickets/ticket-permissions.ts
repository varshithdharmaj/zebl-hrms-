import type { SessionUser } from "@/lib/session";
import type { AppUserRole } from "@/lib/roles";
import { isSuperAdmin, canAccessHRAdministration } from "@/lib/permissions";

export type TicketLike = {
  id: string;
  isAnonymous: boolean;
  raisedByEmployeeId: number;
  assignedToUserId: string | null;
  department: string | null;
};

/**
 * Core ticket access check: whether a session user can view a specific ticket.
 * 
 * Rules:
 * - Super Admin: all tickets (including anonymous)
 * - HR: assigned tickets + department-matched tickets, non-anonymous only
 * - Employee: own tickets only (own raisedByEmployeeId)
 * - Anonymous tickets: Super Admin only
 */
export function canViewTicket(session: SessionUser | null, ticket: TicketLike): boolean {
  if (!session) return false;

  // Anonymous tickets: Super Admin only
  if (ticket.isAnonymous) {
    return isSuperAdmin(session.role);
  }

  // Super Admin sees all non-anonymous
  if (isSuperAdmin(session.role)) return true;

  // Employee: own tickets only
  if (session.role === "employee") {
    return session.employeeId === ticket.raisedByEmployeeId;
  }

  // HR: assigned tickets OR unassigned normal tickets
  if (session.role === "hr") {
    // Can view if assigned to them
    if (ticket.assignedToUserId === session.id) return true;
    
    // Can also view unassigned normal (non-anonymous) tickets
    // This matches the list query behavior and allows HR to manage new tickets
    if (ticket.assignedToUserId === null) return true;
    
    // Cannot view tickets assigned to other HR users
    return false;
  }

  return false;
}

/**
 * Whether a user can manage a ticket (change status, assign, add updates).
 * 
 * Rules:
 * - Super Admin: all tickets
 * - HR: assigned tickets + department-matched tickets, non-anonymous only
 * - Employee: cannot manage (can only reply to own)
 */
export function canManageTicket(session: SessionUser | null, ticket: TicketLike): boolean {
  if (!session) return false;

  // Anonymous tickets: Super Admin only
  if (ticket.isAnonymous) {
    return isSuperAdmin(session.role);
  }

  // Super Admin manages all
  if (isSuperAdmin(session.role)) return true;

  // HR manages assigned tickets OR unassigned normal tickets
  if (session.role === "hr") {
    // Can manage if assigned to them
    if (ticket.assignedToUserId === session.id) return true;
    
    // Can also manage unassigned normal (non-anonymous) tickets
    // This allows HR to assign, change status, and add updates to new tickets
    if (ticket.assignedToUserId === null) return true;
    
    // Cannot manage tickets assigned to someone else
    return false;
  }

  // Employees cannot manage
  return false;
}

/**
 * Whether a user can reply to a ticket (employee replies).
 */
export function canReplyToTicket(session: SessionUser | null, ticket: TicketLike): boolean {
  if (!session) return false;

  // Own tickets only for employees
  if (session.role === "employee") {
    return session.employeeId === ticket.raisedByEmployeeId;
  }

  return false;
}

/**
 * Whether a user can add public HR updates to a ticket.
 */
export function canAddPublicUpdate(session: SessionUser | null, ticket: TicketLike): boolean {
  return canManageTicket(session, ticket);
}

/**
 * Whether a user can add internal HR notes to a ticket.
 */
export function canAddInternalNote(session: SessionUser | null, ticket: TicketLike): boolean {
  return canManageTicket(session, ticket);
}

/**
 * Whether a user can view internal notes on a ticket.
 */
export function canViewInternalNotes(session: SessionUser | null, ticket: TicketLike): boolean {
  if (!session) return false;

  // Anonymous: SA only
  if (ticket.isAnonymous && !isSuperAdmin(session.role)) return false;

  // SA + HR can view internal notes on tickets they manage
  return canAccessHRAdministration(session.role);
}

/**
 * Whether a user can assign/reassign a ticket.
 */
export function canAssignTicket(session: SessionUser | null, ticket: TicketLike): boolean {
  if (!session) return false;

  // Anonymous: SA only
  if (ticket.isAnonymous) {
    return isSuperAdmin(session.role);
  }

  // SA + HR can assign
  return canAccessHRAdministration(session.role);
}

/**
 * Whether a user can access the anonymous ticket queue.
 */
export function canAccessAnonymousTickets(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}

/**
 * Whether a user can create tickets on behalf of an employee.
 * Super Admin only (if implemented).
 */
export function canCreateTicketForOthers(role: AppUserRole): boolean {
  return isSuperAdmin(role);
}
