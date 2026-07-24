import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { buildTicketWhereClause, buildAnonymousTicketWhereClause } from "@/lib/tickets/ticket-access";
import { canViewTicket, canManageTicket, canAssignTicket } from "@/lib/tickets/ticket-permissions";

describe("Helpdesk Production Security Tests", () => {
  const mockEmployee: SessionUser = {
    id: "emp-1",
    email: "emp@zebl.com",
    employeeId: 1,
    role: UserRole.employee,
  } as SessionUser;

  const mockHR: SessionUser = {
    id: "hr-1",
    email: "hr@zebl.com",
    employeeId: 2,
    role: UserRole.hr,
  } as SessionUser;

  const mockSA: SessionUser = {
    id: "sa-1",
    email: "sa@zebl.com",
    employeeId: 3,
    role: UserRole.super_admin,
  } as SessionUser;

  describe("SECURITY: Direct URL Access - Ticket IDs", () => {
    it("Employee cannot manipulate URL to access another employee's ticket", () => {
      const anotherEmployeeTicket = {
        id: "ticket-other",
        isAnonymous: false,
        raisedByEmployeeId: 999, // Different employee
        assignedToUserId: null,
        department: null,
      };

      const result = canViewTicket(mockEmployee, anotherEmployeeTicket);
      expect(result).toBe(false);
    });

    it("Employee cannot manipulate URL to access anonymous ticket", () => {
      const anonymousTicket = {
        id: "ticket-anon",
        isAnonymous: true,
        raisedByEmployeeId: 1, // Even their own
        assignedToUserId: null,
        department: null,
      };

      const result = canViewTicket(mockEmployee, anonymousTicket);
      expect(result).toBe(false);
    });

    it("HR cannot manipulate URL to access unassigned ticket outside department", () => {
      const outsideDeptTicket = {
        id: "ticket-outside",
        isAnonymous: false,
        raisedByEmployeeId: 999,
        assignedToUserId: "other-hr",
        department: "Engineering",
      };

      const result = canViewTicket(mockHR, outsideDeptTicket);
      expect(result).toBe(false);
    });

    it("HR cannot manipulate URL to access anonymous ticket", () => {
      const anonymousTicket = {
        id: "ticket-anon",
        isAnonymous: true,
        raisedByEmployeeId: 1,
        assignedToUserId: "hr-1", // Even if assigned!
        department: null,
      };

      const result = canViewTicket(mockHR, anonymousTicket);
      expect(result).toBe(false);
    });
  });

  describe("SECURITY: Dashboard Count Leakage", () => {
    it("Employee query does not include anonymous tickets in count", () => {
      const where = buildTicketWhereClause(mockEmployee);
      
      expect(where).toHaveProperty("isAnonymous", false);
      expect(where).toHaveProperty("raisedByEmployeeId", 1);
    });

    it("HR query does not include anonymous tickets in count", () => {
      const where = buildTicketWhereClause(mockHR);
      
      expect(where).toHaveProperty("isAnonymous", false);
    });

    it("Anonymous ticket query returns impossible condition for non-SA", () => {
      const employeeWhere = buildAnonymousTicketWhereClause(mockEmployee);
      expect(employeeWhere).toEqual({ id: "impossible" });

      const hrWhere = buildAnonymousTicketWhereClause(mockHR);
      expect(hrWhere).toEqual({ id: "impossible" });
    });

    it("Super Admin can query anonymous tickets", () => {
      const where = buildAnonymousTicketWhereClause(mockSA);
      
      expect(where).toHaveProperty("isAnonymous", true);
      expect(where).not.toHaveProperty("id", "impossible");
    });
  });

  describe("SECURITY: Search Information Disclosure", () => {
    it("Employee search query enforces raisedByEmployeeId", () => {
      const where = buildTicketWhereClause(mockEmployee, {
        search: "test",
      });

      expect(where).toHaveProperty("raisedByEmployeeId", 1);
      expect(where).toHaveProperty("isAnonymous", false);
      expect(where.OR).toBeDefined();
    });

    it("HR search query excludes anonymous tickets and preserves access scope", () => {
      const where = buildTicketWhereClause(mockHR, {
        search: "sensitive",
      });

      expect(where).toHaveProperty("isAnonymous", false);
      expect(where.AND).toBeDefined();
      expect(where.OR).toBeUndefined();
    });

    it("Search cannot enumerate anonymous ticket numbers for non-SA", () => {
      const where = buildTicketWhereClause(mockHR, {
        search: "TKT-ANON",
      });

      // isAnonymous = false ensures no anonymous tickets match
      expect(where).toHaveProperty("isAnonymous", false);
      // Access scope still required alongside search
      expect(where.AND).toBeDefined();
    });
  });

  describe("SECURITY: Status Filter Manipulation", () => {
    it("Employee cannot bypass filter to see all statuses of other employees", () => {
      const where = buildTicketWhereClause(mockEmployee, {
        status: ["new", "resolved"], // Trying all statuses
      });

      // Still enforces employee ID
      expect(where).toHaveProperty("raisedByEmployeeId", 1);
    });

    it("HR cannot bypass filter to see anonymous tickets", () => {
      const where = buildTicketWhereClause(mockHR, {
        status: ["new"],
        category: ["hr"],
      });

      expect(where).toHaveProperty("isAnonymous", false);
    });
  });

  describe("SECURITY: Assignment Manipulation", () => {
    it("HR cannot manage ticket not assigned to them", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: "other-hr",
        department: null,
      };

      const result = canManageTicket(mockHR, ticket);
      expect(result).toBe(false);
    });

    it("HR cannot assign ticket not assigned to them", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: "other-hr",
        department: null,
      };

      expect(canAssignTicket(mockHR, ticket)).toBe(false);
    });

    it("Employee cannot manage their own ticket", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: null,
        department: null,
      };

      const result = canManageTicket(mockEmployee, ticket);
      expect(result).toBe(false);
    });

    it("HR can manage ticket assigned to them", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: "hr-1",
        department: null,
      };

      const result = canManageTicket(mockHR, ticket);
      expect(result).toBe(true);
    });

    it("HR can assign ticket assigned to them", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: "hr-1",
        department: null,
      };

      expect(canAssignTicket(mockHR, ticket)).toBe(true);
    });

    it("Super Admin can assign ticket assigned to another HR", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: "other-hr",
        department: null,
      };

      expect(canAssignTicket(mockSA, ticket)).toBe(true);
    });
  });

  describe("SECURITY: Anonymous Ticket Complete Isolation", () => {
    it("buildTicketWhereClause never returns anonymous for employee", () => {
      const where1 = buildTicketWhereClause(mockEmployee);
      const where2 = buildTicketWhereClause(mockEmployee, { status: "new" });
      const where3 = buildTicketWhereClause(mockEmployee, { search: "test" });

      expect(where1).toHaveProperty("isAnonymous", false);
      expect(where2).toHaveProperty("isAnonymous", false);
      expect(where3).toHaveProperty("isAnonymous", false);
    });

    it("buildTicketWhereClause never returns anonymous for HR", () => {
      const where1 = buildTicketWhereClause(mockHR);
      const where2 = buildTicketWhereClause(mockHR, { priority: "high" });
      const where3 = buildTicketWhereClause(mockHR, { category: "hr" });

      expect(where1).toHaveProperty("isAnonymous", false);
      expect(where2).toHaveProperty("isAnonymous", false);
      expect(where3).toHaveProperty("isAnonymous", false);
    });

    it("Only SA can see anonymous in base query", () => {
      const where = buildTicketWhereClause(mockSA);

      // Should not have isAnonymous filter (sees both)
      expect(where.isAnonymous).toBeUndefined();
    });
  });

  describe("SECURITY: NULL/Undefined Session Handling", () => {
    it("null session cannot view any ticket", () => {
      const ticket = {
        id: "ticket-1",
        isAnonymous: false,
        raisedByEmployeeId: 1,
        assignedToUserId: null,
        department: null,
      };

      const result = canViewTicket(null, ticket);
      expect(result).toBe(false);
    });

    it("employee without employeeId cannot view tickets", () => {
      const noEmployeeSession = {
        ...mockEmployee,
        employeeId: null,
      } as SessionUser;

      const where = buildTicketWhereClause(noEmployeeSession);
      expect(where).toEqual({ id: "impossible" });
    });
  });

  describe("SECURITY: Filter Array Injection", () => {
    it("cannot inject OR condition through status array", () => {
      const where = buildTicketWhereClause(mockHR, {
        status: ["new", "open", "resolved"], // Array of valid statuses
      });

      // Still enforces isAnonymous = false
      expect(where).toHaveProperty("isAnonymous", false);
    });

    it("cannot inject condition through empty filters", () => {
      const where = buildTicketWhereClause(mockHR, {
        status: undefined,
        category: undefined,
      });

      expect(where).toHaveProperty("isAnonymous", false);
    });
  });
});
