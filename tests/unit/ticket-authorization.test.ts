import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/session";
import {
  canViewTicket,
  canManageTicket,
  canReplyToTicket,
  canAddPublicUpdate,
  canAddInternalNote,
  canViewInternalNotes,
  canAssignTicket,
  type TicketLike,
} from "@/lib/tickets/ticket-permissions";
import {
  buildTicketWhereClause,
  buildAnonymousTicketWhereClause,
} from "@/lib/tickets/ticket-access";
import { canAccessAnonymousTickets } from "@/lib/permissions";

const superAdminSession: SessionUser = {
  id: "sa-1",
  email: "admin@test.local",
  role: "super_admin",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

const hrSession: SessionUser = {
  id: "hr-1",
  email: "hr@test.local",
  role: "hr",
  employeeId: 100,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

const employeeSession: SessionUser = {
  id: "emp-1",
  email: "employee@test.local",
  role: "employee",
  employeeId: 200,
  employeeName: "Employee User",
  sessionVersion: 1,
  authProvider: "local",
};

const otherEmployeeSession: SessionUser = {
  id: "emp-2",
  email: "other@test.local",
  role: "employee",
  employeeId: 201,
  employeeName: "Other Employee",
  sessionVersion: 1,
  authProvider: "local",
};

const normalTicket: TicketLike = {
  id: "ticket-1",
  isAnonymous: false,
  raisedByEmployeeId: 200,
  assignedToUserId: "hr-1",
  department: "Engineering",
};

const anonymousTicket: TicketLike = {
  id: "ticket-anon",
  isAnonymous: true,
  raisedByEmployeeId: 200,
  assignedToUserId: null,
  department: "Engineering",
};

const unassignedTicket: TicketLike = {
  id: "ticket-unassigned",
  isAnonymous: false,
  raisedByEmployeeId: 201,
  assignedToUserId: null,
  department: "HR",
};

describe("Ticket Authorization — View Access", () => {
  it("Super Admin can view normal tickets", () => {
    expect(canViewTicket(superAdminSession, normalTicket)).toBe(true);
  });

  it("Super Admin can view anonymous tickets", () => {
    expect(canViewTicket(superAdminSession, anonymousTicket)).toBe(true);
  });

  it("HR can view assigned tickets", () => {
    expect(canViewTicket(hrSession, normalTicket)).toBe(true);
  });

  it("HR cannot view anonymous tickets", () => {
    expect(canViewTicket(hrSession, anonymousTicket)).toBe(false);
  });

  it("Employee can view own tickets", () => {
    expect(canViewTicket(employeeSession, normalTicket)).toBe(true);
  });

  it("Employee cannot view another employee's ticket", () => {
    expect(canViewTicket(employeeSession, unassignedTicket)).toBe(false);
  });

  it("Employee cannot view anonymous tickets (even own)", () => {
    // Employee who raised an anonymous ticket should be able to see it
    // in their "My tickets" — but this is edge case. For now, strictest rule.
    expect(canViewTicket(employeeSession, anonymousTicket)).toBe(false);
  });

  it("Unauthenticated user cannot view tickets", () => {
    expect(canViewTicket(null, normalTicket)).toBe(false);
  });
});

describe("Ticket Authorization — Management", () => {
  it("Super Admin can manage normal tickets", () => {
    expect(canManageTicket(superAdminSession, normalTicket)).toBe(true);
  });

  it("Super Admin can manage anonymous tickets", () => {
    expect(canManageTicket(superAdminSession, anonymousTicket)).toBe(true);
  });

  it("HR can manage assigned tickets", () => {
    expect(canManageTicket(hrSession, normalTicket)).toBe(true);
  });

  it("HR cannot manage anonymous tickets", () => {
    expect(canManageTicket(hrSession, anonymousTicket)).toBe(false);
  });

  it("HR CAN manage unassigned normal tickets", () => {
    // HR should be able to manage unassigned tickets so they can assign, update status, etc.
    expect(canManageTicket(hrSession, unassignedTicket)).toBe(true);
  });

  it("HR CANNOT manage tickets assigned to other HR users", () => {
    const ticketAssignedToOtherHR = {
      id: "ticket-10",
      isAnonymous: false,
      raisedByEmployeeId: 50,
      assignedToUserId: "other-hr-user-id",
      department: "IT",
    };
    expect(canManageTicket(hrSession, ticketAssignedToOtherHR)).toBe(false);
  });

  it("Employee cannot manage own tickets", () => {
    expect(canManageTicket(employeeSession, normalTicket)).toBe(false);
  });
});

describe("Ticket Authorization — Employee Actions", () => {
  it("Employee can reply to own tickets", () => {
    expect(canReplyToTicket(employeeSession, normalTicket)).toBe(true);
  });

  it("Employee cannot reply to another employee's ticket", () => {
    expect(canReplyToTicket(employeeSession, unassignedTicket)).toBe(false);
  });

  it("HR cannot use employee reply action", () => {
    expect(canReplyToTicket(hrSession, normalTicket)).toBe(false);
  });

  it("Super Admin cannot use employee reply action", () => {
    expect(canReplyToTicket(superAdminSession, normalTicket)).toBe(false);
  });
});

describe("Ticket Authorization — HR Actions", () => {
  it("HR can add public updates to assigned tickets", () => {
    expect(canAddPublicUpdate(hrSession, normalTicket)).toBe(true);
  });

  it("HR can add internal notes to assigned tickets", () => {
    expect(canAddInternalNote(hrSession, normalTicket)).toBe(true);
  });

  it("HR cannot add updates to anonymous tickets", () => {
    expect(canAddPublicUpdate(hrSession, anonymousTicket)).toBe(false);
    expect(canAddInternalNote(hrSession, anonymousTicket)).toBe(false);
  });

  it("HR can view internal notes on managed tickets", () => {
    expect(canViewInternalNotes(hrSession, normalTicket)).toBe(true);
  });

  it("HR cannot view internal notes on anonymous tickets", () => {
    expect(canViewInternalNotes(hrSession, anonymousTicket)).toBe(false);
  });

  it("Employee cannot view internal notes", () => {
    expect(canViewInternalNotes(employeeSession, normalTicket)).toBe(false);
  });

  it("Super Admin can view internal notes on all tickets", () => {
    expect(canViewInternalNotes(superAdminSession, normalTicket)).toBe(true);
    expect(canViewInternalNotes(superAdminSession, anonymousTicket)).toBe(true);
  });
});

describe("Ticket Authorization — Assignment", () => {
  it("HR can assign tickets", () => {
    expect(canAssignTicket(hrSession, normalTicket)).toBe(true);
  });

  it("HR cannot assign anonymous tickets", () => {
    expect(canAssignTicket(hrSession, anonymousTicket)).toBe(false);
  });

  it("Super Admin can assign anonymous tickets", () => {
    expect(canAssignTicket(superAdminSession, anonymousTicket)).toBe(true);
  });

  it("Employee cannot assign tickets", () => {
    expect(canAssignTicket(employeeSession, normalTicket)).toBe(false);
  });
});

describe("Ticket Authorization — Anonymous Queue Access", () => {
  it("Super Admin can access anonymous queue", () => {
    expect(canAccessAnonymousTickets("super_admin")).toBe(true);
  });

  it("HR cannot access anonymous queue", () => {
    expect(canAccessAnonymousTickets("hr")).toBe(false);
  });

  it("Employee cannot access anonymous queue", () => {
    expect(canAccessAnonymousTickets("employee")).toBe(false);
  });
});

describe("Ticket Query Filtering — WHERE Clause", () => {
  it("Super Admin WHERE clause includes anonymous tickets", () => {
    const where = buildTicketWhereClause(superAdminSession);
    expect(where.isAnonymous).toBeUndefined(); // No filter = all tickets
  });

  it("HR WHERE clause explicitly excludes anonymous tickets", () => {
    const where = buildTicketWhereClause(hrSession);
    expect(where.isAnonymous).toBe(false);
  });

  it("Employee WHERE clause explicitly excludes anonymous tickets", () => {
    const where = buildTicketWhereClause(employeeSession);
    expect(where.isAnonymous).toBe(false);
  });

  it("Employee WHERE clause restricts to own raisedByEmployeeId", () => {
    const where = buildTicketWhereClause(employeeSession);
    expect(where.raisedByEmployeeId).toBe(200);
  });

  it("HR WHERE clause includes OR conditions for assigned/unassigned", () => {
    const where = buildTicketWhereClause(hrSession);
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it("Employee without employeeId gets impossible WHERE clause", () => {
    const sessionWithoutEmployee: SessionUser = {
      ...employeeSession,
      employeeId: null,
    };
    const where = buildTicketWhereClause(sessionWithoutEmployee);
    expect(where.id).toBe("impossible");
  });
});

describe("Ticket Query Filtering — Anonymous Queue", () => {
  it("Super Admin can query anonymous tickets", () => {
    const where = buildAnonymousTicketWhereClause(superAdminSession);
    expect(where.isAnonymous).toBe(true);
    expect(where.id).not.toBe("impossible");
  });

  it("HR gets impossible WHERE clause for anonymous queue", () => {
    const where = buildAnonymousTicketWhereClause(hrSession);
    expect(where.id).toBe("impossible");
  });

  it("Employee gets impossible WHERE clause for anonymous queue", () => {
    const where = buildAnonymousTicketWhereClause(employeeSession);
    expect(where.id).toBe("impossible");
  });
});

describe("Ticket Query Filtering — Search and Filters", () => {
  it("Applies status filter to WHERE clause", () => {
    const where = buildTicketWhereClause(superAdminSession, { status: "open" });
    expect(where.status).toBe("open");
  });

  it("Applies priority filter to WHERE clause", () => {
    const where = buildTicketWhereClause(superAdminSession, { priority: "high" });
    expect(where.priority).toBe("high");
  });

  it("Applies category filter to WHERE clause", () => {
    const where = buildTicketWhereClause(superAdminSession, { category: "hr" });
    expect(where.category).toBe("hr");
  });

  it("Applies search to OR clause for ticketNumber, subject, description", () => {
    const where = buildTicketWhereClause(superAdminSession, { search: "test" });
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
    if (Array.isArray(where.OR)) {
      expect(where.OR.length).toBeGreaterThan(0);
    }
  });

  it("Non-SA search still excludes anonymous tickets", () => {
    const where = buildTicketWhereClause(hrSession, { search: "test" });
    expect(where.isAnonymous).toBe(false);
  });
});

describe("Ticket Authorization — Edge Cases", () => {
  it("Null session cannot view tickets", () => {
    expect(canViewTicket(null, normalTicket)).toBe(false);
  });

  it("Null session cannot manage tickets", () => {
    expect(canManageTicket(null, normalTicket)).toBe(false);
  });

  it("Null session cannot reply to tickets", () => {
    expect(canReplyToTicket(null, normalTicket)).toBe(false);
  });

  it("Anonymous ticket with assigned HR still hidden from HR", () => {
    const assignedAnonymous: TicketLike = {
      ...anonymousTicket,
      assignedToUserId: "hr-1",
    };
    expect(canViewTicket(hrSession, assignedAnonymous)).toBe(false);
    expect(canManageTicket(hrSession, assignedAnonymous)).toBe(false);
  });

  it("Super Admin can manage anonymous ticket regardless of assignment", () => {
    expect(canManageTicket(superAdminSession, anonymousTicket)).toBe(true);
  });
});

describe("Ticket Authorization — Department Manager (No Special Role)", () => {
  // Per architecture analysis: no separate "Department Manager" role exists.
  // Department filtering for HR is basic string matching on Employee.department.
  // This test confirms HR cannot bypass anonymous restrictions via department.

  it("HR user cannot access anonymous ticket in their department", () => {
    const anonInHRDept: TicketLike = {
      ...anonymousTicket,
      department: "HR",
    };
    expect(canViewTicket(hrSession, anonInHRDept)).toBe(false);
  });
});
