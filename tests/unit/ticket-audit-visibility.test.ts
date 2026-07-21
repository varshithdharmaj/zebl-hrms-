import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@prisma/client";
import {
  getTicketAuditHistory,
  canViewTicketAuditHistory,
  formatAuditAction,
  getTicketAuditSummary,
} from "@/lib/audit/ticket-audit";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ticket: {
      findUnique: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

const mockEmployeeSession = {
  id: "emp-user-1",
  email: "employee@zebl.com",
  employeeId: 1,
  role: UserRole.employee,
} as SessionUser;

const mockHrSession = {
  id: "hr-user-1",
  email: "hr@zebl.com",
  employeeId: 2,
  role: UserRole.hr,
} as SessionUser;

const mockSuperAdminSession = {
  id: "sa-user-1",
  email: "sa@zebl.com",
  employeeId: 3,
  role: UserRole.super_admin,
} as SessionUser;

const mockNormalTicket = {
  id: "ticket-1",
  isAnonymous: false,
  raisedByEmployeeId: 1,
  assignedToUserId: "hr-user-1", // Assigned to HR for testing HR access
  department: "HR",
};

const mockAnonymousTicket = {
  id: "ticket-anon-1",
  isAnonymous: true,
  raisedByEmployeeId: 1,
  assignedToUserId: null,
  department: null,
};

const mockAuditLogs = [
  {
    id: "audit-1",
    entityType: "ticket",
    entityId: "ticket-1",
    action: "ticket.created",
    actorUserId: "emp-user-1",
    actorEmail: "employee@zebl.com",
    metadata: JSON.stringify({
      ticketNumber: "TKT-001",
      category: "hr",
      type: "complaint",
      priority: "medium",
      isAnonymous: false,
      raisedByEmployeeId: 1,
    }),
    createdAt: new Date("2026-07-21T10:00:00Z"),
  },
  {
    id: "audit-2",
    entityType: "ticket",
    entityId: "ticket-1",
    action: "ticket.assigned",
    actorUserId: "hr-user-1",
    actorEmail: "hr@zebl.com",
    metadata: JSON.stringify({
      assignedToUserId: "hr-user-1",
      previousAssignedToUserId: null,
    }),
    createdAt: new Date("2026-07-21T10:05:00Z"),
  },
];

const mockAnonymousAuditLogs = [
  {
    id: "audit-anon-1",
    entityType: "ticket",
    entityId: "ticket-anon-1",
    action: "ticket.created.anonymous",
    actorUserId: "emp-user-1",
    actorEmail: "employee@zebl.com",
    metadata: JSON.stringify({
      ticketNumber: "TKT-ANON-001",
      category: "workplace",
      type: "anonymous_complaint",
      priority: "high",
      isAnonymous: true,
      raisedByEmployeeId: 1, // Identity preserved in audit for SA/compliance
    }),
    createdAt: new Date("2026-07-21T11:00:00Z"),
  },
];

describe("Ticket Audit History - Visibility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTicketAuditHistory", () => {
    it("returns audit history for employee viewing their own normal ticket", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockNormalTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockAuditLogs as any);

      const result = await getTicketAuditHistory("ticket-1", mockEmployeeSession);

      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe("ticket.created");
      expect(result[1]?.action).toBe("ticket.assigned");
      expect(result[0]?.metadata).toHaveProperty("raisedByEmployeeId", 1);
    });

    it("returns empty array for employee viewing another employee's ticket", async () => {
      const otherEmployeeTicket = {
        ...mockNormalTicket,
        raisedByEmployeeId: 999,
      };

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(otherEmployeeTicket as any);

      const result = await getTicketAuditHistory("ticket-1", mockEmployeeSession);

      expect(result).toHaveLength(0);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("returns audit history for HR viewing normal ticket", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockNormalTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockAuditLogs as any);

      const result = await getTicketAuditHistory("ticket-1", mockHrSession);

      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe("ticket.created");
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: "ticket",
          entityId: "ticket-1",
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array for HR viewing anonymous ticket", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await getTicketAuditHistory("ticket-anon-1", mockHrSession);

      expect(result).toHaveLength(0);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("returns audit history for Super Admin viewing anonymous ticket", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(mockAnonymousAuditLogs)) as any
      );

      const result = await getTicketAuditHistory("ticket-anon-1", mockSuperAdminSession);

      expect(result).toHaveLength(1);
      expect(result[0]?.action).toBe("ticket.created.anonymous");
      expect(result[0]?.metadata).toHaveProperty("isAnonymous", true);
      expect(result[0]?.metadata).toHaveProperty("raisedByEmployeeId", 1);
    });

    it("returns empty array when session is null", async () => {
      const result = await getTicketAuditHistory("ticket-1", null);

      expect(result).toHaveLength(0);
      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
    });

    it("returns empty array when ticket does not exist", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(null);

      const result = await getTicketAuditHistory("nonexistent", mockEmployeeSession);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for employee viewing their own anonymous ticket", async () => {
      // Even the employee who raised an anonymous ticket cannot view its audit
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await getTicketAuditHistory("ticket-anon-1", mockEmployeeSession);

      // Employee can view the ticket itself, but not if it's anonymous
      // Actually, employees CAN view their own anonymous tickets, but audit history is SA-only
      // Let me check the canViewTicket logic...
      // Based on ticket-permissions.ts, employees CAN view their own anonymous tickets
      // But audit history should still be SA-only for anonymous tickets
      expect(result).toHaveLength(0);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe("canViewTicketAuditHistory", () => {
    it("returns true for employee viewing their own normal ticket audit", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockNormalTicket as any);

      const result = await canViewTicketAuditHistory("ticket-1", mockEmployeeSession);

      expect(result).toBe(true);
    });

    it("returns false for employee viewing another employee's ticket audit", async () => {
      const otherEmployeeTicket = {
        ...mockNormalTicket,
        raisedByEmployeeId: 999,
      };

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(otherEmployeeTicket as any);

      const result = await canViewTicketAuditHistory("ticket-1", mockEmployeeSession);

      expect(result).toBe(false);
    });

    it("returns true for HR viewing normal ticket audit", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockNormalTicket as any);

      const result = await canViewTicketAuditHistory("ticket-1", mockHrSession);

      expect(result).toBe(true);
    });

    it("returns false for HR viewing anonymous ticket audit", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await canViewTicketAuditHistory("ticket-anon-1", mockHrSession);

      expect(result).toBe(false);
    });

    it("returns true for Super Admin viewing anonymous ticket audit", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await canViewTicketAuditHistory("ticket-anon-1", mockSuperAdminSession);

      expect(result).toBe(true);
    });

    it("returns false when session is null", async () => {
      const result = await canViewTicketAuditHistory("ticket-1", null);

      expect(result).toBe(false);
    });

    it("returns false when ticket does not exist", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(null);

      const result = await canViewTicketAuditHistory("nonexistent", mockEmployeeSession);

      expect(result).toBe(false);
    });

    it("returns false for employee viewing their own anonymous ticket audit", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await canViewTicketAuditHistory("ticket-anon-1", mockEmployeeSession);

      expect(result).toBe(false);
    });
  });

  describe("getTicketAuditSummary", () => {
    it("returns limited audit history (last 5 events)", async () => {
      const employeeTicket = {
        ...mockNormalTicket,
        raisedByEmployeeId: 1,
        assignedToUserId: null,
      };

      const manyAuditLogs = Array.from({ length: 10 }, (_, i) => ({
        ...mockAuditLogs[0]!,
        id: `audit-${i}`,
        action: `ticket.action.${i}`,
        createdAt: new Date(Date.now() - i * 60000),
      }));

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(employeeTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(manyAuditLogs)) as any
      );

      const result = await getTicketAuditSummary("ticket-1", mockEmployeeSession, 5);

      expect(result).toHaveLength(5);
    });

    it("returns all audit history if less than limit", async () => {
      const employeeTicket = {
        ...mockNormalTicket,
        raisedByEmployeeId: 1,
        assignedToUserId: null,
      };

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(employeeTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(mockAuditLogs)) as any
      );

      const result = await getTicketAuditSummary("ticket-1", mockEmployeeSession, 10);

      expect(result).toHaveLength(2);
    });
  });

  describe("formatAuditAction", () => {
    it("formats ticket audit actions correctly", () => {
      expect(formatAuditAction("ticket.created")).toBe("Created");
      expect(formatAuditAction("ticket.created.anonymous")).toBe("Created Anonymous");
      expect(formatAuditAction("ticket.status.changed")).toBe("Status Changed");
      expect(formatAuditAction("ticket.assigned")).toBe("Assigned");
      expect(formatAuditAction("ticket.update.added")).toBe("Update Added");
      expect(formatAuditAction("ticket.internal_note.added")).toBe("Internal Note Added");
      expect(formatAuditAction("ticket.reply.added")).toBe("Reply Added");
    });
  });

  describe("Security: Anonymous Ticket Audit Preservation", () => {
    it("preserves actual employee identity in anonymous ticket audit metadata", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(mockAnonymousAuditLogs)) as any
      );

      const result = await getTicketAuditHistory("ticket-anon-1", mockSuperAdminSession);

      expect(result).toHaveLength(1);
      expect(result[0]?.metadata).toHaveProperty("raisedByEmployeeId", 1);
      expect(result[0]?.metadata).toHaveProperty("isAnonymous", true);
      expect(result[0]?.action).toBe("ticket.created.anonymous");
    });

    it("does not expose anonymous ticket audit through normal employee queries", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await getTicketAuditHistory("ticket-anon-1", mockEmployeeSession);

      expect(result).toHaveLength(0);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("does not expose anonymous ticket audit through HR queries", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);

      const result = await getTicketAuditHistory("ticket-anon-1", mockHrSession);

      expect(result).toHaveLength(0);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("Super Admin can see complete audit trail including sensitive metadata", async () => {
      const detailedAnonymousAudit = [
        {
          ...mockAnonymousAuditLogs[0]!,
        },
        {
          id: "audit-anon-2",
          entityType: "ticket",
          entityId: "ticket-anon-1",
          action: "ticket.status.changed",
          actorUserId: "sa-user-1",
          actorEmail: "sa@zebl.com",
          metadata: JSON.stringify({
            oldStatus: "new",
            newStatus: "in_progress",
            assignedBySuperAdmin: true,
          }),
          createdAt: new Date("2026-07-21T11:30:00Z"),
        },
      ];

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockAnonymousTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(detailedAnonymousAudit)) as any
      );

      const result = await getTicketAuditHistory("ticket-anon-1", mockSuperAdminSession);

      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe("ticket.created.anonymous");
      expect(result[1]?.action).toBe("ticket.status.changed");
    });
  });

  describe("Security: Audit Query Filtering", () => {
    it("constructs proper audit query with entityType and entityId", async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(mockNormalTicket as any);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(
        JSON.parse(JSON.stringify(mockAuditLogs)) as any
      );

      await getTicketAuditHistory("ticket-1", mockHrSession);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: "ticket",
          entityId: "ticket-1",
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("does not call audit query if ticket authorization fails", async () => {
      const otherEmployeeTicket = {
        ...mockNormalTicket,
        raisedByEmployeeId: 999,
      };

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(otherEmployeeTicket as any);

      await getTicketAuditHistory("ticket-1", mockEmployeeSession);

      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });
  });
});
