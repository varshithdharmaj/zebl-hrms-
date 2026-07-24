import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/session";
import {
  canViewTicket,
  canManageTicket,
  canAssignTicket,
  canAddPublicUpdate,
  canAddInternalNote,
  canViewInternalNotes,
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

const anonymousTicket: TicketLike = {
  id: "anon-ticket-1",
  isAnonymous: true,
  raisedByEmployeeId: 200,
  assignedToUserId: "hr-1",
  department: "Engineering",
};

const anonymousTicketUnassigned: TicketLike = {
  id: "anon-ticket-2",
  isAnonymous: true,
  raisedByEmployeeId: 201,
  assignedToUserId: null,
  department: "HR",
};

describe("Anonymous Ticket Access Control — Super Admin Only", () => {
  describe("View Access", () => {
    it("Super Admin can view anonymous tickets", () => {
      expect(canViewTicket(superAdminSession, anonymousTicket)).toBe(true);
      expect(canViewTicket(superAdminSession, anonymousTicketUnassigned)).toBe(true);
    });

    it("HR User cannot view anonymous tickets (even if assigned)", () => {
      expect(canViewTicket(hrSession, anonymousTicket)).toBe(false);
    });

    it("HR User cannot view unassigned anonymous tickets", () => {
      expect(canViewTicket(hrSession, anonymousTicketUnassigned)).toBe(false);
    });

    it("Employee cannot view anonymous tickets (even own)", () => {
      expect(canViewTicket(employeeSession, anonymousTicket)).toBe(false);
    });

    it("Employee who raised anonymous ticket cannot view it", () => {
      // Employee's own anonymous ticket
      const ownAnonymousTicket: TicketLike = {
        ...anonymousTicket,
        raisedByEmployeeId: 200, // Same as employeeSession.employeeId
      };
      expect(canViewTicket(employeeSession, ownAnonymousTicket)).toBe(false);
    });
  });

  describe("Management Actions", () => {
    it("Super Admin can manage anonymous tickets", () => {
      expect(canManageTicket(superAdminSession, anonymousTicket)).toBe(true);
      expect(canManageTicket(superAdminSession, anonymousTicketUnassigned)).toBe(true);
    });

    it("HR User cannot manage anonymous tickets (even if assigned)", () => {
      expect(canManageTicket(hrSession, anonymousTicket)).toBe(false);
    });

    it("Employee cannot manage anonymous tickets", () => {
      expect(canManageTicket(employeeSession, anonymousTicket)).toBe(false);
    });
  });

  describe("Assignment Actions", () => {
    it("Super Admin can assign anonymous tickets", () => {
      expect(canAssignTicket(superAdminSession, anonymousTicket)).toBe(true);
      expect(canAssignTicket(superAdminSession, anonymousTicketUnassigned)).toBe(true);
    });

    it("HR User cannot assign anonymous tickets", () => {
      expect(canAssignTicket(hrSession, anonymousTicket)).toBe(false);
      expect(canAssignTicket(hrSession, anonymousTicketUnassigned)).toBe(false);
    });

    it("Employee cannot assign anonymous tickets", () => {
      expect(canAssignTicket(employeeSession, anonymousTicket)).toBe(false);
    });
  });

  describe("Update Actions", () => {
    it("Super Admin can add public updates to anonymous tickets", () => {
      expect(canAddPublicUpdate(superAdminSession, anonymousTicket)).toBe(true);
    });

    it("Super Admin can add internal notes to anonymous tickets", () => {
      expect(canAddInternalNote(superAdminSession, anonymousTicket)).toBe(true);
    });

    it("HR User cannot add updates to anonymous tickets", () => {
      expect(canAddPublicUpdate(hrSession, anonymousTicket)).toBe(false);
      expect(canAddInternalNote(hrSession, anonymousTicket)).toBe(false);
    });

    it("Employee cannot add updates to anonymous tickets", () => {
      expect(canAddPublicUpdate(employeeSession, anonymousTicket)).toBe(false);
      expect(canAddInternalNote(employeeSession, anonymousTicket)).toBe(false);
    });
  });

  describe("Internal Notes Visibility", () => {
    it("Super Admin can view internal notes on anonymous tickets", () => {
      expect(canViewInternalNotes(superAdminSession, anonymousTicket)).toBe(true);
    });

    it("HR User cannot view internal notes on anonymous tickets", () => {
      expect(canViewInternalNotes(hrSession, anonymousTicket)).toBe(false);
    });

    it("Employee cannot view internal notes on anonymous tickets", () => {
      expect(canViewInternalNotes(employeeSession, anonymousTicket)).toBe(false);
    });
  });

  describe("Anonymous Queue Access", () => {
    it("Super Admin can access anonymous ticket queue", () => {
      expect(canAccessAnonymousTickets("super_admin")).toBe(true);
    });

    it("HR User cannot access anonymous ticket queue", () => {
      expect(canAccessAnonymousTickets("hr")).toBe(false);
    });

    it("Employee cannot access anonymous ticket queue", () => {
      expect(canAccessAnonymousTickets("employee")).toBe(false);
    });
  });
});

describe("Anonymous Ticket Query Filtering — Existence Protection", () => {
  describe("Standard Ticket Queries (Non-Anonymous)", () => {
    it("Super Admin normal ticket query does NOT filter anonymous tickets", () => {
      const where = buildTicketWhereClause(superAdminSession);
      // No isAnonymous filter = includes both normal and anonymous
      expect(where.isAnonymous).toBeUndefined();
    });

    it("HR User normal ticket query explicitly excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(hrSession);
      expect(where.isAnonymous).toBe(false);
    });

    it("Employee normal ticket query explicitly excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(employeeSession);
      expect(where.isAnonymous).toBe(false);
    });

    it("HR User query with search still excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(hrSession, { search: "test query" });
      expect(where.isAnonymous).toBe(false);
      // Access scope AND search — search must not replace HR OR
      expect(where.AND).toBeDefined();
      expect(Array.isArray(where.AND)).toBe(true);
    });

    it("Employee query with filters still excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(employeeSession, {
        status: "open",
        category: "hr",
        priority: "high",
      });
      expect(where.isAnonymous).toBe(false);
      expect(where.status).toBeDefined();
    });
  });

  describe("Anonymous Ticket Queries (Super Admin Only)", () => {
    it("Super Admin can query anonymous tickets explicitly", () => {
      const where = buildAnonymousTicketWhereClause(superAdminSession);
      expect(where.isAnonymous).toBe(true);
      expect(where.id).not.toBe("impossible");
    });

    it("HR User gets impossible WHERE for anonymous ticket query", () => {
      const where = buildAnonymousTicketWhereClause(hrSession);
      expect(where.id).toBe("impossible");
    });

    it("Employee gets impossible WHERE for anonymous ticket query", () => {
      const where = buildAnonymousTicketWhereClause(employeeSession);
      expect(where.id).toBe("impossible");
    });

    it("HR User cannot bypass with search on anonymous queue", () => {
      const where = buildAnonymousTicketWhereClause(hrSession, { search: "bypass attempt" });
      expect(where.id).toBe("impossible");
    });

    it("HR User cannot bypass with filters on anonymous queue", () => {
      const where = buildAnonymousTicketWhereClause(hrSession, {
        status: "new",
        category: "hr",
        priority: "high",
      });
      expect(where.id).toBe("impossible");
    });
  });

  describe("Dashboard Stats Protection", () => {
    it("Super Admin stats query includes anonymous tickets", () => {
      const where = buildTicketWhereClause(superAdminSession);
      expect(where.isAnonymous).toBeUndefined(); // No filter
    });

    it("HR User stats query excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(hrSession);
      expect(where.isAnonymous).toBe(false);
    });

    it("Employee stats query excludes anonymous tickets", () => {
      const where = buildTicketWhereClause(employeeSession);
      expect(where.isAnonymous).toBe(false);
    });
  });

  describe("Search and Filter Bypass Protection", () => {
    it("HR cannot find anonymous ticket via ticket number search", () => {
      const where = buildTicketWhereClause(hrSession, { search: "TKT-20260721-0001" });
      expect(where.isAnonymous).toBe(false); // Still excluded
    });

    it("HR cannot find anonymous ticket via subject search", () => {
      const where = buildTicketWhereClause(hrSession, { search: "anonymous complaint" });
      expect(where.isAnonymous).toBe(false); // Still excluded
    });

    it("Employee cannot find anonymous ticket via category filter", () => {
      const where = buildTicketWhereClause(employeeSession, { category: "hr" });
      expect(where.isAnonymous).toBe(false); // Still excluded
    });

    it("HR cannot combine filters to bypass anonymous exclusion", () => {
      const where = buildTicketWhereClause(hrSession, {
        status: "new",
        category: "hr",
        priority: "high",
        search: "test",
      });
      expect(where.isAnonymous).toBe(false); // Still excluded
    });
  });
});

describe("Anonymous Ticket Access — Edge Cases", () => {
  it("Anonymous ticket assigned to HR is still hidden from HR", () => {
    const assignedToHR: TicketLike = {
      ...anonymousTicket,
      assignedToUserId: "hr-1", // Same as hrSession.id
    };
    expect(canViewTicket(hrSession, assignedToHR)).toBe(false);
    expect(canManageTicket(hrSession, assignedToHR)).toBe(false);
  });

  it("Anonymous ticket in HR user's department is still hidden", () => {
    const inHRDept: TicketLike = {
      ...anonymousTicket,
      department: "HR", // HR user's department
      assignedToUserId: null,
    };
    expect(canViewTicket(hrSession, inHRDept)).toBe(false);
  });

  it("Super Admin with employee profile can still view anonymous tickets", () => {
    const saWithEmployee: SessionUser = {
      ...superAdminSession,
      employeeId: 100,
      employeeName: "SA Employee",
    };
    expect(canViewTicket(saWithEmployee, anonymousTicket)).toBe(true);
  });

  it("Null session cannot access anonymous tickets", () => {
    expect(canViewTicket(null, anonymousTicket)).toBe(false);
    expect(canManageTicket(null, anonymousTicket)).toBe(false);
  });
});

describe("Anonymous Ticket — Data Exposure Protection", () => {
  it("Employee query WHERE clause never returns anonymous tickets", () => {
    const where = buildTicketWhereClause(employeeSession);
    // This WHERE clause, when used in a Prisma query, will exclude all anonymous tickets
    expect(where.isAnonymous).toBe(false);
    expect(where.raisedByEmployeeId).toBe(200); // Own tickets only
  });

  it("HR query WHERE clause never returns anonymous tickets", () => {
    const where = buildTicketWhereClause(hrSession);
    // This WHERE clause, when used in a Prisma query, will exclude all anonymous tickets
    expect(where.isAnonymous).toBe(false);
  });

  it("Anonymous ticket query by non-SA returns impossible condition", () => {
    const hrWhere = buildAnonymousTicketWhereClause(hrSession);
    const empWhere = buildAnonymousTicketWhereClause(employeeSession);

    // These WHERE clauses will return zero results (no record has id="impossible")
    expect(hrWhere.id).toBe("impossible");
    expect(empWhere.id).toBe("impossible");
  });
});
