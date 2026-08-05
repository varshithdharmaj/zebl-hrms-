import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";

const isLineManager = vi.fn();
const resolveScope = vi.fn();
const getAttendanceRecords = vi.fn();
const getPayrollSettings = vi.fn();

vi.mock("@/lib/people-scope/engine", () => ({
  PeopleScopeEngine: {
    isLineManager: (...args: unknown[]) => isLineManager(...args),
    resolveScope: (...args: unknown[]) => resolveScope(...args),
  },
}));

vi.mock("@/lib/data/attendance", () => ({
  getAttendanceRecords: (...args: unknown[]) => getAttendanceRecords(...args),
}));

vi.mock("@/lib/payroll/payroll-settings", () => ({
  getPayrollSettings: (...args: unknown[]) => getPayrollSettings(...args),
}));

vi.mock("@/lib/payroll/payroll-types", () => ({
  resolveShiftPayrollRules: () => ({
    graceMinutes: 15,
    requiredOfficeMinutes: 480,
    otThresholdMinutes: 0,
  }),
}));

vi.mock("@/lib/payroll/payroll-calculations", () => ({
  isLateAttendanceRecord: (r: { remarks?: string | null; status?: string }) =>
    (r.remarks ?? "").toLowerCase().includes("late") || r.status === "Short Hours",
  isEarlyExitAttendanceRecord: (r: { remarks?: string | null }) =>
    (r.remarks ?? "").toLowerCase().includes("early"),
}));

vi.mock("@/lib/attendance-shift", () => ({
  formatTimeAmPm: (v: string | null) => v ?? "—",
  formatWorkedDurationDisplay: (_d: string | null, m: number) => `${m}m`,
  formatOvertimeDisplay: (m: number) => (m > 0 ? `${m}m` : "—"),
}));

import { listMyTeamAttendance } from "@/lib/manager/team-attendance-query";

describe("listMyTeamAttendance", () => {
  beforeEach(() => {
    isLineManager.mockReset();
    resolveScope.mockReset();
    getAttendanceRecords.mockReset();
    getPayrollSettings.mockReset();

    isLineManager.mockResolvedValue(true);
    resolveScope.mockResolvedValue({
      mode: "DIRECT",
      employeeIds: [1, 2],
      departments: ["Eng"],
    });
    getPayrollSettings.mockResolvedValue({
      graceMinutes: 15,
      requiredOfficeMinutes: 480,
      otThresholdMinutes: 0,
    });
    getAttendanceRecords.mockResolvedValue({
      records: [
        {
          id: 10,
          checkIn: "09:30",
          checkOut: "18:00",
          workDuration: "8:00",
          workedMinutes: 480,
          overtimeMinutes: 0,
          status: "Short Hours",
          remarks: "Late arrival",
          attendanceDate: new Date("2026-03-01"),
          employee: {
            id: 1,
            name: "Ada",
            employeeCode: "E1",
            department: "Eng",
            designation: "IC",
            shift: "General",
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
  });

  it("denies non-line-managers", async () => {
    isLineManager.mockResolvedValue(false);
    await expect(listMyTeamAttendance(100)).rejects.toBeInstanceOf(PermissionError);
    expect(getAttendanceRecords).not.toHaveBeenCalled();
  });

  it("returns empty without calling attendance layer when scope is empty", async () => {
    resolveScope.mockResolvedValue({ mode: "DIRECT", employeeIds: [], departments: [] });
    const result = await listMyTeamAttendance(100);
    expect(result.total).toBe(0);
    expect(getAttendanceRecords).not.toHaveBeenCalled();
  });

  it("passes scoped employeeIds into getAttendanceRecords (no managerId)", async () => {
    await listMyTeamAttendance(100, {
      search: "Ada",
      from: "2026-03-01",
      to: "2026-03-31",
      status: "Present",
      lateOnly: true,
      earlyExitOnly: false,
      overtimeOnly: true,
      shortfallOnly: false,
      sort: "name",
      sortDir: "asc",
      page: 2,
    });

    expect(resolveScope).toHaveBeenCalledWith(100);
    expect(getAttendanceRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeIds: [1, 2],
        search: "Ada",
        from: "2026-03-01",
        to: "2026-03-31",
        status: "Present",
        late: true,
        ot: true,
        shortfall: false,
        sort: "name",
        sortDir: "asc",
        page: 2,
      })
    );
    const arg = getAttendanceRecords.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("managerId");
    expect(JSON.stringify(arg)).not.toContain("managerId");
  });

  it("maps rows to manager DTOs with late/early flags", async () => {
    const result = await listMyTeamAttendance(100);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      employeeName: "Ada",
      employeeCode: "E1",
      status: "Short Hours",
      isLate: true,
      hasShortfall: true,
    });
    expect(result.items[0]).not.toHaveProperty("email");
    expect(result.items[0]).not.toHaveProperty("phone");
  });
});
