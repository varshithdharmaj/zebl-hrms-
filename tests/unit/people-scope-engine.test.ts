import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionError } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import { toManagerSafeEmployee } from "@/lib/people-scope/manager-safe-dto";
import { TERMINAL_EMPLOYEE_STATUSES } from "@/lib/people-scope/terminal-statuses";

const findMany = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("@/lib/org", () => ({
  detectCircularManagerRelationship: vi.fn(async () => false),
}));

const MANAGER_ID = 100;

function activeReport(overrides: Partial<{
  id: number;
  name: string;
  department: string | null;
  employeeStatus: string;
  isActive: boolean;
}> = {}) {
  const id = overrides.id ?? 1;
  return {
    id,
    employeeCode: `E${id}`,
    name: overrides.name ?? `Report ${id}`,
    department: overrides.department ?? "Engineering",
    designation: "Engineer",
    employeeStatus: overrides.employeeStatus ?? "Active",
    isActive: overrides.isActive ?? true,
    shift: "General",
    joiningDate: new Date("2024-01-15"),
    workLocation: "HQ",
    employmentType: "Full-time",
  };
}

describe("PeopleScopeEngine", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
  });

  describe("DIRECT where clause", () => {
    it("queries with isActive true and terminal statuses excluded", async () => {
      findMany.mockResolvedValue([]);
      await PeopleScopeEngine.getDirectReportIds(MANAGER_ID);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            managerId: MANAGER_ID,
            isActive: true,
            employeeStatus: { notIn: [...TERMINAL_EMPLOYEE_STATUSES] },
          },
        })
      );
    });
  });

  describe("isLineManager", () => {
    it("returns false when employee has no in-scope reports", async () => {
      count.mockResolvedValue(0);
      await expect(PeopleScopeEngine.isLineManager(MANAGER_ID)).resolves.toBe(false);
    });

    it("returns true when at least one in-scope report exists", async () => {
      count.mockResolvedValue(1);
      await expect(PeopleScopeEngine.isLineManager(MANAGER_ID)).resolves.toBe(true);
    });
  });

  describe("getDirectReportIds / resolveScope", () => {
    it("returns empty for no reports", async () => {
      findMany.mockResolvedValue([]);
      await expect(PeopleScopeEngine.getDirectReportIds(MANAGER_ID)).resolves.toEqual([]);
      await expect(PeopleScopeEngine.resolveScope(MANAGER_ID)).resolves.toEqual({
        mode: "DIRECT",
        employeeIds: [],
        departments: [],
      });
    });

    it("returns one active report", async () => {
      findMany.mockResolvedValueOnce([{ id: 1 }]);
      await expect(PeopleScopeEngine.getDirectReportIds(MANAGER_ID)).resolves.toEqual([1]);

      findMany.mockResolvedValueOnce([{ id: 1, department: "Engineering" }]);
      await expect(PeopleScopeEngine.resolveScope(MANAGER_ID)).resolves.toEqual({
        mode: "DIRECT",
        employeeIds: [1],
        departments: ["Engineering"],
      });
    });

    it("returns multiple reports and distinct departments", async () => {
      findMany.mockResolvedValue([
        { id: 1, department: "Engineering" },
        { id: 2, department: "Engineering" },
        { id: 3, department: "Ops" },
        { id: 4, department: null },
      ]);
      const scope = await PeopleScopeEngine.resolveScope(MANAGER_ID);
      expect(scope.employeeIds).toEqual([1, 2, 3, 4]);
      expect(scope.departments).toEqual(["Engineering", "Ops"]);
    });

    it("is cycle-safe: DIRECT uses a flat query (no hierarchy walk)", async () => {
      findMany.mockResolvedValue([{ id: 1, department: "Eng" }]);
      await PeopleScopeEngine.resolveScope(MANAGER_ID);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe("assertInScope / isInScope", () => {
    it("succeeds when subject is an in-scope direct report", async () => {
      findFirst.mockResolvedValue({ id: 1 });
      await expect(PeopleScopeEngine.assertInScope(MANAGER_ID, 1)).resolves.toBeUndefined();
      await expect(PeopleScopeEngine.isInScope(MANAGER_ID, 1)).resolves.toBe(true);
    });

    it("fails when subject is not in scope", async () => {
      findFirst.mockResolvedValue(null);
      await expect(PeopleScopeEngine.assertInScope(MANAGER_ID, 99)).rejects.toBeInstanceOf(
        PermissionError
      );
      await expect(PeopleScopeEngine.isInScope(MANAGER_ID, 99)).resolves.toBe(false);
    });

    it("fails when actor asserts scope over self", async () => {
      await expect(PeopleScopeEngine.assertInScope(MANAGER_ID, MANAGER_ID)).rejects.toBeInstanceOf(
        PermissionError
      );
      expect(findFirst).not.toHaveBeenCalled();
    });

    it("assert query requires active non-terminal report under manager", async () => {
      findFirst.mockResolvedValue(null);
      await PeopleScopeEngine.isInScope(MANAGER_ID, 5);
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          id: 5,
          managerId: MANAGER_ID,
          isActive: true,
          employeeStatus: { notIn: [...TERMINAL_EMPLOYEE_STATUSES] },
        },
        select: { id: true },
      });
    });
  });

  describe("eligibility filters (via where clause contract)", () => {
    it("excludes inactive reports via isActive filter", async () => {
      count.mockResolvedValue(0);
      await PeopleScopeEngine.isLineManager(MANAGER_ID);
      expect(count).toHaveBeenCalledWith({
        where: expect.objectContaining({ isActive: true }),
      });
    });

    it("excludes resigned, terminated, and inactive statuses via notIn", async () => {
      expect(TERMINAL_EMPLOYEE_STATUSES).toEqual(["Inactive", "Resigned", "Terminated"]);
      findMany.mockResolvedValue([]);
      await PeopleScopeEngine.getDirectReportIds(MANAGER_ID);
      const where = findMany.mock.calls[0]?.[0]?.where as {
        employeeStatus: { notIn: string[] };
      };
      expect(where.employeeStatus.notIn).toContain("Resigned");
      expect(where.employeeStatus.notIn).toContain("Terminated");
      expect(where.employeeStatus.notIn).toContain("Inactive");
    });
  });

  describe("listDirectReportsSafe / getDirectReportSafe", () => {
    it("maps list rows to manager-safe DTOs", async () => {
      findMany.mockResolvedValue([activeReport({ id: 1 })]);
      const list = await PeopleScopeEngine.listDirectReportsSafe(MANAGER_ID);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: 1,
        employeeCode: "E1",
        name: "Report 1",
        department: "Engineering",
      });
      expect(list[0]).not.toHaveProperty("email");
      expect(list[0]).not.toHaveProperty("phone");
    });

    it("getDirectReportSafe asserts then returns DTO", async () => {
      findFirst.mockResolvedValue({ id: 1 });
      findUnique.mockResolvedValue(activeReport({ id: 1 }));
      const dto = await PeopleScopeEngine.getDirectReportSafe(MANAGER_ID, 1);
      expect(dto.id).toBe(1);
      expect(dto).not.toHaveProperty("address");
    });

    it("getDirectReportSafe fails when out of scope", async () => {
      findFirst.mockResolvedValue(null);
      await expect(PeopleScopeEngine.getDirectReportSafe(MANAGER_ID, 9)).rejects.toBeInstanceOf(
        PermissionError
      );
    });
  });
});

describe("toManagerSafeEmployee", () => {
  it("excludes protected HR fields", () => {
    const dto = toManagerSafeEmployee({
      id: 1,
      employeeCode: "E1",
      name: "Ada",
      department: "Eng",
      designation: "IC",
      employeeStatus: "Active",
      isActive: true,
      shift: "A",
      joiningDate: new Date("2020-01-01"),
      workLocation: "Remote",
      employmentType: "Full-time",
      email: "secret@zebl.com",
      phone: "999",
      alternatePhone: "888",
      address: "123 Hidden St",
      emergencyContact: "Mom",
      dateOfBirth: new Date("1990-01-01"),
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: "Ada",
    });

    expect(dto).toEqual({
      id: 1,
      employeeCode: "E1",
      name: "Ada",
      department: "Eng",
      designation: "IC",
      employeeStatus: "Active",
      isActive: true,
      shift: "A",
      joiningDate: new Date("2020-01-01"),
      workLocation: "Remote",
      employmentType: "Full-time",
    });

    const keys = Object.keys(dto);
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("phone");
    expect(keys).not.toContain("alternatePhone");
    expect(keys).not.toContain("address");
    expect(keys).not.toContain("emergencyContact");
    expect(keys).not.toContain("dateOfBirth");
  });
});
