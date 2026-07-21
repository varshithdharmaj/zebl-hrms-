import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@prisma/client";
import {
  getSuperAdminRecipients,
  getHrRecipientsForTickets,
  getTicketRaiserRecipient,
  getTicketHandlerRecipient,
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyTicketUpdated,
  notifyEmployeeReplied,
  notifyTicketStatusChanged,
  notifyTicketResolved,
} from "@/lib/notifications/ticket-notifications";
import { prisma } from "@/lib/prisma";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock notification queue
vi.mock("@/lib/notifications/notification-queue", () => ({
  enqueueNotification: vi.fn(async (input) => input.recipient),
}));

// Mock sanitizeEmail
vi.mock("@/lib/notifications/sanitize", () => ({
  sanitizeEmail: (email: string) => email,
}));

const mockSuperAdmin = {
  id: "sa-1",
  email: "sa@zebl.com",
  employee: { name: "Super Admin" },
};

const mockHrUser = {
  id: "hr-1",
  email: "hr@zebl.com",
  employee: { name: "HR User" },
};

const mockEmployee = {
  id: "emp-1",
  email: "emp@zebl.com",
  employee: { name: "Employee User" },
};

describe("Ticket Notification Recipient Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSuperAdminRecipients", () => {
    it("returns only Super Admin users", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { ...mockSuperAdmin } as any,
      ]);

      const recipients = await getSuperAdminRecipients();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.super_admin, isActive: true },
        select: { id: true, email: true, employee: { select: { name: true } } },
      });
      expect(recipients).toHaveLength(1);
      expect(recipients[0]?.email).toBe("sa@zebl.com");
      expect(recipients[0]?.role).toBe("super_admin");
    });

    it("excludes HR and employee roles", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { ...mockSuperAdmin } as any,
      ]);

      await getSuperAdminRecipients();

      expect(prisma.user.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: expect.objectContaining({ in: expect.arrayContaining([UserRole.hr]) }),
          }),
        })
      );
    });

    it("excludes inactive Super Admins", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      const recipients = await getSuperAdminRecipients();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
      expect(recipients).toHaveLength(0);
    });
  });

  describe("getHrRecipientsForTickets", () => {
    it("returns HR and Super Admin users", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { ...mockSuperAdmin } as any,
        { ...mockHrUser } as any,
      ]);

      const recipients = await getHrRecipientsForTickets();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { in: [UserRole.super_admin, UserRole.hr] },
          isActive: true,
        },
        select: { id: true, email: true, employee: { select: { name: true } } },
      });
      expect(recipients).toHaveLength(2);
    });

    it("excludes employee role from HR recipients", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockHrUser } as any]);

      await getHrRecipientsForTickets();

      const call = vi.mocked(prisma.user.findMany).mock.calls[0]?.[0];
      expect(call?.where?.role).toEqual({ in: [UserRole.super_admin, UserRole.hr] });
    });
  });

  describe("notifyTicketCreated - Anonymous Ticket", () => {
    it("notifies ONLY Super Admin for anonymous tickets", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous complaint",
        raisedByEmployeeId: 1,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      // Should notify employee (the raiser)
      const calls = vi.mocked(enqueueNotification).mock.calls;
      const empCall = calls.find((call) => call[0]?.recipient === "emp@zebl.com");
      expect(empCall).toBeDefined();
      expect(empCall?.[0]?.subject).toContain("TKT-001");

      // Should notify Super Admin ONLY (not HR)
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");
      expect(saCall).toBeDefined();
      expect(saCall?.[0]?.subject).toBe("Anonymous ticket received (Super Admin Only)");

      // Should not call getHrRecipientsForTickets for anonymous tickets
      expect(enqueueNotification).toHaveBeenCalledTimes(2); // employee + SA
    });

    it("does NOT notify HR users for anonymous tickets", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous complaint",
        raisedByEmployeeId: 1,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      // Verify no HR user was notified
      const calls = vi.mocked(enqueueNotification).mock.calls;
      const hrNotifications = calls.filter((call) => call[0]?.recipient === "hr@zebl.com");
      expect(hrNotifications).toHaveLength(0);
    });

    it("does not leak anonymous ticket subject to unauthorized recipients", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Sensitive anonymous subject",
        raisedByEmployeeId: 1,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      const calls = vi.mocked(enqueueNotification).mock.calls;
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");

      // SA notification should not expose subject directly
      expect(saCall?.[0]?.subject).not.toContain("Sensitive anonymous subject");
      expect(saCall?.[0]?.payload).toEqual({
        ticketNumber: "TKT-001",
        message: "A new anonymous ticket requires Super Admin attention.",
      });
    });
  });

  describe("notifyTicketCreated - Normal Ticket", () => {
    it("notifies HR users for normal (non-anonymous) tickets", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-002",
        subject: "Normal ticket",
        raisedByEmployeeId: 1,
        isAnonymous: false,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { ...mockSuperAdmin } as any,
        { ...mockHrUser } as any,
      ]);

      await notifyTicketCreated("t-1", false);

      // Should notify employee
      const calls = vi.mocked(enqueueNotification).mock.calls;
      const empCall = calls.find((call) => call[0]?.recipient === "emp@zebl.com");
      expect(empCall).toBeDefined();

      // Should notify HR users
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");
      expect(saCall).toBeDefined();
      expect(saCall?.[0]?.subject).toBe("New ticket: Normal ticket");

      const hrCall = calls.find((call) => call[0]?.recipient === "hr@zebl.com");
      expect(hrCall).toBeDefined();
    });

    it("includes ticket subject for normal tickets", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-002",
        subject: "Payroll inquiry",
        raisedByEmployeeId: 1,
        isAnonymous: false,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockHrUser } as any]);

      await notifyTicketCreated("t-1", false);

      const calls = vi.mocked(enqueueNotification).mock.calls;
      const hrCall = calls.find((call) => call[0]?.recipient === "hr@zebl.com");
      expect(hrCall?.[0]?.payload).toEqual({
        ticketNumber: "TKT-002",
        subject: "Payroll inquiry",
      });
    });
  });

  describe("notifyTicketUpdated - Anonymous Ticket", () => {
    it("notifies Super Admin for anonymous ticket public updates", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous ticket",
        raisedByEmployeeId: 1,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketUpdated("t-1", "public_update");

      // Should notify employee
      const calls = vi.mocked(enqueueNotification).mock.calls;
      const empCall = calls.find((call) => call[0]?.recipient === "emp@zebl.com");
      expect(empCall).toBeDefined();
      expect(empCall?.[0]?.subject).toContain("TKT-001");

      // Should notify Super Admin
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");
      expect(saCall).toBeDefined();
      expect(saCall?.[0]?.subject).toBe("Anonymous ticket updated (Super Admin Only)");
    });

    it("does NOT notify for internal notes", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      await notifyTicketUpdated("t-1", "internal_note");

      // Should not send any notification for internal notes
      expect(enqueueNotification).not.toHaveBeenCalled();
    });
  });

  describe("notifyEmployeeReplied - Anonymous Ticket", () => {
    it("notifies ONLY Super Admin when employee replies to anonymous ticket", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous ticket",
        assignedToUserId: null,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyEmployeeReplied("t-1");

      // Should notify Super Admin
      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("sa@zebl.com");
      expect(calls[0]?.[0]?.subject).toBe("Anonymous ticket reply (Super Admin Only)");

      // Should not notify HR
      expect(enqueueNotification).toHaveBeenCalledTimes(1);
    });

    it("notifies assigned handler for anonymous ticket if SA assigned", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous ticket",
        assignedToUserId: "sa-1",
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockSuperAdmin } as any);

      await notifyEmployeeReplied("t-1");

      // Should notify the assigned SA handler
      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("sa@zebl.com");
      expect(calls[0]?.[0]?.subject).toContain("Employee replied");
    });
  });

  describe("notifyEmployeeReplied - Normal Ticket", () => {
    it("notifies assigned HR handler for normal ticket", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-002",
        subject: "Normal ticket",
        assignedToUserId: "hr-1",
        isAnonymous: false,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockHrUser } as any);

      await notifyEmployeeReplied("t-1");

      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("hr@zebl.com");
      expect(calls[0]?.[0]?.subject).toContain("Employee replied");
    });

    it("notifies HR pool for unassigned normal ticket", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-002",
        subject: "Unassigned ticket",
        assignedToUserId: null,
        isAnonymous: false,
      } as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { ...mockSuperAdmin } as any,
        { ...mockHrUser } as any,
      ]);

      await notifyEmployeeReplied("t-1");

      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(2);
      
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");
      expect(saCall).toBeDefined();
      expect(saCall?.[0]?.subject).toContain("unassigned ticket");

      const hrCall = calls.find((call) => call[0]?.recipient === "hr@zebl.com");
      expect(hrCall).toBeDefined();
      expect(hrCall?.[0]?.subject).toContain("unassigned ticket");
    });
  });

  describe("notifyTicketAssigned", () => {
    it("notifies the assigned handler", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Ticket subject",
        isAnonymous: false,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockHrUser } as any);

      await notifyTicketAssigned("t-1", "hr-1");

      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("hr@zebl.com");
      expect(calls[0]?.[0]?.subject).toBe("Ticket TKT-001 assigned to you");
    });

    it("includes isAnonymous flag in payload", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous ticket",
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockSuperAdmin } as any);

      await notifyTicketAssigned("t-1", "sa-1");

      const call = vi.mocked(enqueueNotification).mock.calls[0];
      expect(call?.[0]?.payload).toEqual({
        ticketNumber: "TKT-001",
        subject: "Anonymous ticket",
        isAnonymous: true,
      });
    });
  });

  describe("notifyTicketStatusChanged", () => {
    it("notifies the employee who raised the ticket", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Ticket subject",
        raisedByEmployeeId: 1,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);

      await notifyTicketStatusChanged("t-1", "in_progress");

      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("emp@zebl.com");
      expect(calls[0]?.[0]?.subject).toContain("status changed");
      expect(calls[0]?.[0]?.payload).toMatchObject({ newStatus: "in_progress" });
    });
  });

  describe("notifyTicketResolved", () => {
    it("notifies the employee with resolution notes", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Ticket subject",
        raisedByEmployeeId: 1,
        resolutionNotes: "Resolved by admin",
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);

      await notifyTicketResolved("t-1");

      const calls = vi.mocked(enqueueNotification).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]?.recipient).toBe("emp@zebl.com");
      expect(calls[0]?.[0]?.subject).toBe("Ticket TKT-001 resolved");
      expect(calls[0]?.[0]?.payload).toMatchObject({
        resolutionNotes: "Resolved by admin",
      });
    });
  });

  describe("Security: Anonymous Ticket Information Leakage Prevention", () => {
    it("never includes employee identity in anonymous ticket notifications to SA", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Anonymous complaint",
        raisedByEmployeeId: 42,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      const calls = vi.mocked(enqueueNotification).mock.calls;
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");

      // Should not leak employee ID
      expect(saCall).toBeDefined();
      const payloadStr = JSON.stringify(saCall?.[0]?.payload);
      expect(payloadStr).not.toContain("42");
      expect(payloadStr).not.toContain("raisedByEmployeeId");
    });

    it("never sends anonymous ticket number to HR users", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-ANON-001",
        subject: "Anonymous",
        raisedByEmployeeId: 1,
        isAnonymous: true,
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      const calls = vi.mocked(enqueueNotification).mock.calls;
      const hrCalls = calls.filter(
        (call) => call[0]?.recipient === "hr@zebl.com" && call[0]?.type !== "ticket_created"
      );

      // HR should not receive any anonymous ticket notifications
      expect(hrCalls).toHaveLength(0);
    });

    it("never sends anonymous ticket category to unauthorized users", async () => {
      const { enqueueNotification } = await import("@/lib/notifications/notification-queue");

      vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
        id: "t-1",
        ticketNumber: "TKT-001",
        subject: "Harassment complaint",
        raisedByEmployeeId: 1,
        isAnonymous: true,
        category: "workplace",
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockEmployee } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ ...mockSuperAdmin } as any]);

      await notifyTicketCreated("t-1", true);

      const calls = vi.mocked(enqueueNotification).mock.calls;
      const saCall = calls.find((call) => call[0]?.recipient === "sa@zebl.com");

      // Should not leak category
      expect(saCall).toBeDefined();
      const payloadStr = JSON.stringify(saCall?.[0]?.payload);
      expect(payloadStr).not.toContain("workplace");
      expect(payloadStr).not.toContain("Harassment");
    });
  });
});
