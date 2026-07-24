import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildAbsenceSnapshotFromRecords } from "@/lib/hr/command-center";
import { getLeaveOverlapWarnings } from "@/lib/leave/leave-overlap";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("buildAbsenceSnapshotFromRecords", () => {
  it("counts all absent rows and ranks departments with ≥2 absences", () => {
    const snapshot = buildAbsenceSnapshotFromRecords([
      { employee: { department: "Eng" } },
      { employee: { department: "Eng" } },
      { employee: { department: "HR" } },
      { employee: { department: "Eng" } },
      { employee: { department: null } },
      { employee: { department: null } },
    ]);

    expect(snapshot.absentToday).toBe(6);
    expect(snapshot.departmentsShortStaffed).toEqual([
      { department: "Eng", absentCount: 3 },
      { department: "Unassigned", absentCount: 2 },
    ]);
  });

  it("omits departments with a single absence", () => {
    const snapshot = buildAbsenceSnapshotFromRecords([
      { employee: { department: "Sales" } },
    ]);
    expect(snapshot.absentToday).toBe(1);
    expect(snapshot.departmentsShortStaffed).toEqual([]);
  });
});

describe("getLeaveOverlapWarnings", () => {
  beforeEach(() => {
    vi.mocked(prisma.leaveRequest.findMany).mockReset();
  });

  it("runs employee and team overlap queries in parallel and preserves warning order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    vi.mocked(prisma.leaveRequest.findMany).mockImplementation((async (args) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;

      const isTeam = Boolean(
        args &&
          typeof args === "object" &&
          "where" in args &&
          args.where &&
          typeof args.where === "object" &&
          "employee" in args.where &&
          args.where.employee &&
          typeof args.where.employee === "object" &&
          "department" in args.where.employee
      );

      if (isTeam) {
        return [
          {
            id: 20,
            leaveType: "CL",
            workflowStatus: "approved",
            employee: { name: "Teammate" },
          },
        ] as never;
      }

      return [
        {
          id: 10,
          leaveType: "EL",
          workflowStatus: "pending_approval",
          employee: { name: "Self" },
        },
      ] as never;
    }) as typeof prisma.leaveRequest.findMany);

    const warnings = await getLeaveOverlapWarnings({
      leaveRequestId: 1,
      employeeId: 5,
      department: "Eng",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-03"),
    });

    expect(prisma.leaveRequest.findMany).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(2);
    expect(warnings.map((w) => w.type)).toEqual(["employee_overlap", "team_overlap"]);
    expect(warnings[0]?.relatedLeaveId).toBe(10);
    expect(warnings[1]?.relatedLeaveId).toBe(20);
  });

  it("skips team query when department is null", async () => {
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);

    await getLeaveOverlapWarnings({
      leaveRequestId: 1,
      employeeId: 5,
      department: null,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-03"),
    });

    expect(prisma.leaveRequest.findMany).toHaveBeenCalledTimes(1);
  });
});
