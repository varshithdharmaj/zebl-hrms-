import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { detectCircularManagerRelationship } from "@/lib/org";
import { toManagerSafeEmployee } from "@/lib/people-scope/manager-safe-dto";
import { terminalEmployeeStatusesForQuery } from "@/lib/people-scope/terminal-statuses";
import type {
  EmployeeForManagerSafeDto,
  ManagerSafeEmployee,
  PeopleScope,
  PeopleScopeMode,
  ResolveScopeOptions,
} from "@/lib/people-scope/types";

const DIRECT_REPORT_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  department: true,
  designation: true,
  employeeStatus: true,
  isActive: true,
  shift: true,
  joiningDate: true,
  workLocation: true,
  employmentType: true,
} as const;

function directScopeWhere(managerEmployeeId: number) {
  return {
    managerId: managerEmployeeId,
    isActive: true,
    employeeStatus: { notIn: terminalEmployeeStatusesForQuery() },
  };
}

/**
 * PeopleScopeEngine — single source of truth for My Team hierarchy scope (PRD).
 *
 * Hierarchy-based only. Does not authorize leave steps or recruitment assignments.
 * Reuses {@link detectCircularManagerRelationship} from `org.ts` for cycle checks.
 */
export const PeopleScopeEngine = {
  /**
   * Line manager iff at least one DIRECT in-scope report exists (PRD eligibility).
   * Used by {@link employeeHasDirectReports} / My Team nav context (Phase 2).
   */
  async isLineManager(employeeId: number): Promise<boolean> {
    const count = await prisma.employee.count({
      where: directScopeWhere(employeeId),
    });
    return count > 0;
  },

  /** In-scope direct report IDs for DIRECT mode (ordered by name). */
  async getDirectReportIds(managerEmployeeId: number): Promise<number[]> {
    const rows = await prisma.employee.findMany({
      where: directScopeWhere(managerEmployeeId),
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => r.id);
  },

  /**
   * Resolves people scope for an actor employee.
   * V1: DIRECT only. Flat query — does not walk the tree (cycle-safe by construction).
   */
  async resolveScope(
    managerEmployeeId: number,
    options: ResolveScopeOptions = {}
  ): Promise<PeopleScope> {
    const mode: PeopleScopeMode = options.mode ?? "DIRECT";
    if (mode !== "DIRECT") {
      throw new PermissionError(`Unsupported people scope mode: ${String(mode)}`);
    }

    const rows = await prisma.employee.findMany({
      where: directScopeWhere(managerEmployeeId),
      select: { id: true, department: true },
      orderBy: { name: "asc" },
    });

    const employeeIds = rows.map((r) => r.id);
    const departments = [
      ...new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d))),
    ];

    return { mode, employeeIds, departments };
  },

  /**
   * Throws {@link PermissionError} when subject is outside the actor's scope.
   */
  async assertInScope(
    managerEmployeeId: number,
    subjectEmployeeId: number,
    options: ResolveScopeOptions = {}
  ): Promise<void> {
    if (managerEmployeeId === subjectEmployeeId) {
      throw new PermissionError("Subject is outside manager scope.");
    }

    const mode: PeopleScopeMode = options.mode ?? "DIRECT";
    if (mode !== "DIRECT") {
      throw new PermissionError(`Unsupported people scope mode: ${String(mode)}`);
    }

    const subject = await prisma.employee.findFirst({
      where: {
        id: subjectEmployeeId,
        ...directScopeWhere(managerEmployeeId),
      },
      select: { id: true },
    });

    if (!subject) {
      throw new PermissionError("Subject is outside manager scope.");
    }
  },

  /** Whether subject is in actor's DIRECT scope (no throw). */
  async isInScope(
    managerEmployeeId: number,
    subjectEmployeeId: number,
    options: ResolveScopeOptions = {}
  ): Promise<boolean> {
    try {
      await PeopleScopeEngine.assertInScope(managerEmployeeId, subjectEmployeeId, options);
      return true;
    } catch (e) {
      if (e instanceof PermissionError) return false;
      throw e;
    }
  },

  /**
   * Loads DIRECT reports as manager-safe DTOs (no protected HR fields).
   */
  async listDirectReportsSafe(managerEmployeeId: number): Promise<ManagerSafeEmployee[]> {
    const rows = await prisma.employee.findMany({
      where: directScopeWhere(managerEmployeeId),
      select: DIRECT_REPORT_SELECT,
      orderBy: { name: "asc" },
    });
    return rows.map((row) => toManagerSafeEmployee(row));
  },

  /**
   * Loads one subject as manager-safe DTO after scope assertion.
   */
  async getDirectReportSafe(
    managerEmployeeId: number,
    subjectEmployeeId: number
  ): Promise<ManagerSafeEmployee> {
    await PeopleScopeEngine.assertInScope(managerEmployeeId, subjectEmployeeId);

    const row = await prisma.employee.findUnique({
      where: { id: subjectEmployeeId },
      select: DIRECT_REPORT_SELECT,
    });
    if (!row) {
      throw new PermissionError("Subject is outside manager scope.");
    }
    return toManagerSafeEmployee(row);
  },

  /** Pure mapper — see {@link toManagerSafeEmployee}. */
  toManagerSafeEmployee(employee: EmployeeForManagerSafeDto): ManagerSafeEmployee {
    return toManagerSafeEmployee(employee);
  },

  /**
   * Re-exports org cycle detection for callers consolidating on this module.
   * Does not alter assignment rules — admin mutations still own writes.
   */
  detectCircularManagerRelationship,
};
