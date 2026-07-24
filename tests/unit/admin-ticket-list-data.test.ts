import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildTicketWhereClause,
  buildTicketCountWhere,
} from "@/lib/tickets/ticket-access";
import type { SessionUser } from "@/lib/session";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ticket: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  fetchAdminTicketListPageData,
  hydrateAdminTicketListRelations,
  getAdminTicketListScalarSelect,
} from "@/lib/tickets/admin-ticket-list-data";
// Keep direct path — barrel intentionally omits this server-only module.

function hrSession(): SessionUser {
  return {
    id: "hr-1",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    mustChangePassword: false,
    sessionVersion: 1,
    authProvider: "local",
  };
}

function saSession(): SessionUser {
  return {
    id: "sa-1",
    email: "sa@example.com",
    role: "super_admin",
    employeeId: 2,
    employeeName: "SA User",
    mustChangePassword: false,
    sessionVersion: 1,
    authProvider: "local",
  };
}

describe("fetchAdminTicketListPageData", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findMany).mockReset();
    vi.mocked(prisma.ticket.count).mockReset();
    vi.mocked(prisma.ticket.groupBy).mockReset();
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.employee.findMany).mockReset();
  });

  it("runs scalar list, count, status groupBy, and priority groupBy in parallel", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const track = async <T>(value: T): Promise<T> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return value;
    };

    vi.mocked(prisma.ticket.findMany).mockImplementation(
      (() => track([] as never)) as never
    );
    vi.mocked(prisma.ticket.count).mockImplementation((() => track(0)) as never);
    vi.mocked(prisma.ticket.groupBy).mockImplementation(
      (() => track([] as never)) as never
    );

    const session = hrSession();
    const whereClause = buildTicketWhereClause(session, { status: "open" });
    const statsWhere = buildTicketCountWhere(session);

    await fetchAdminTicketListPageData({
      whereClause,
      statsWhere,
      skip: 0,
      take: 50,
    });

    expect(prisma.ticket.findMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.ticket.findMany).mock.calls[0]?.[0]?.select).toEqual(
      getAdminTicketListScalarSelect()
    );
    expect(prisma.ticket.count).toHaveBeenCalledTimes(1);
    expect(prisma.ticket.groupBy).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(4);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it("keeps filtered list WHERE separate from unfiltered stats WHERE", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.ticket.count).mockResolvedValue(0);
    vi.mocked(prisma.ticket.groupBy).mockResolvedValue([] as never);

    const session = hrSession();
    const whereClause = buildTicketWhereClause(session, {
      status: "open",
      category: "it",
      priority: "high",
      search: "vpn",
    });
    const statsWhere = buildTicketCountWhere(session);

    expect(whereClause).not.toEqual(statsWhere);
    expect(whereClause).toMatchObject({
      isAnonymous: false,
      status: "open",
      category: "it",
      priority: "high",
    });
    expect(statsWhere).toMatchObject({ isAnonymous: false });

    await fetchAdminTicketListPageData({
      whereClause,
      statsWhere,
      skip: 50,
      take: 50,
    });

    expect(vi.mocked(prisma.ticket.findMany).mock.calls[0]?.[0]?.where).toBe(whereClause);
    expect(vi.mocked(prisma.ticket.count).mock.calls[0]?.[0]?.where).toBe(whereClause);
    for (const call of vi.mocked(prisma.ticket.groupBy).mock.calls) {
      expect(call[0]?.where).toBe(statsWhere);
    }
  });

  it("preserves anonymous exclusion for HR stats scope and not for SA", () => {
    const hrWhere = buildTicketCountWhere(hrSession());
    const saWhere = buildTicketCountWhere(saSession());
    expect(hrWhere).toMatchObject({ isAnonymous: false });
    expect(saWhere).not.toHaveProperty("isAnonymous");
  });

  it("hydrates assignee and raised-by in parallel after the scalar list", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const track = async <T>(value: T): Promise<T> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return value;
    };

    vi.mocked(prisma.ticket.findMany).mockResolvedValue([
      {
        id: "t1",
        ticketNumber: "T-1",
        subject: "VPN",
        category: "it",
        priority: "high",
        status: "open",
        isAnonymous: false,
        department: "Eng",
        assignedToUserId: "u1",
        raisedByEmployeeId: 10,
        updatedAt: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "t2",
        ticketNumber: "T-2",
        subject: "Unassigned",
        category: "hr",
        priority: "low",
        status: "new",
        isAnonymous: false,
        department: null,
        assignedToUserId: null,
        raisedByEmployeeId: 11,
        updatedAt: new Date("2026-01-02"),
        createdAt: new Date("2026-01-02"),
      },
    ] as never);
    vi.mocked(prisma.ticket.count).mockResolvedValue(2);
    vi.mocked(prisma.ticket.groupBy).mockResolvedValue([] as never);

    vi.mocked(prisma.user.findMany).mockImplementation(
      (() =>
        track([
          {
            id: "u1",
            email: "assignee@example.com",
            employee: { name: "Assignee Name" },
          },
        ] as never)) as never
    );
    vi.mocked(prisma.employee.findMany).mockImplementation(
      (() =>
        track([
          { id: 10, name: "Raiser A", employeeCode: "E10" },
          { id: 11, name: "Raiser B", employeeCode: "E11" },
        ] as never)) as never
    );

    const result = await fetchAdminTicketListPageData({
      whereClause: buildTicketWhereClause(hrSession()),
      statsWhere: buildTicketCountWhere(hrSession()),
      skip: 0,
      take: 50,
    });

    expect(maxInFlight).toBe(2);
    expect(result.tickets[0]?.assignedToUser).toEqual({
      id: "u1",
      email: "assignee@example.com",
      employee: { name: "Assignee Name" },
    });
    expect(result.tickets[0]?.raisedByEmployee).toEqual({
      id: 10,
      name: "Raiser A",
      employeeCode: "E10",
    });
    expect(result.tickets[1]?.assignedToUser).toBeNull();
    expect(result.tickets[1]?.raisedByEmployee.name).toBe("Raiser B");
  });
});

describe("hydrateAdminTicketListRelations", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findMany).mockReset();
    vi.mocked(prisma.employee.findMany).mockReset();
  });

  it("supports null assignee and maps raiser fields", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: 5, name: "Only Raiser", employeeCode: "E5" },
    ] as never);

    const rows = await hydrateAdminTicketListRelations([
      {
        id: "t",
        ticketNumber: "T",
        subject: "S",
        category: "it_technical",
        priority: "medium",
        status: "new",
        isAnonymous: false,
        department: null,
        assignedToUserId: null,
        raisedByEmployeeId: 5,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(rows[0]?.assignedToUser).toBeNull();
    expect(rows[0]?.raisedByEmployee).toEqual({
      id: 5,
      name: "Only Raiser",
      employeeCode: "E5",
    });
  });

  it("falls back when assignee user has no employee relation", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u9", email: "solo@example.com", employee: null },
    ] as never);
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { id: 5, name: "Raiser", employeeCode: "E5" },
    ] as never);

    const rows = await hydrateAdminTicketListRelations([
      {
        id: "t",
        ticketNumber: "T",
        subject: "S",
        category: "it_technical",
        priority: "medium",
        status: "new",
        isAnonymous: false,
        department: null,
        assignedToUserId: "u9",
        raisedByEmployeeId: 5,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    expect(rows[0]?.assignedToUser).toEqual({
      id: "u9",
      email: "solo@example.com",
      employee: null,
    });
  });
});
