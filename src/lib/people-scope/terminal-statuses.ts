import type { EmployeeStatus } from "@/lib/employee-types";

/**
 * Employee statuses excluded from My Team DIRECT scope (PRD).
 * Combined with `isActive === true`, in-scope reports are effectively `Active` only.
 */
export const TERMINAL_EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  "Inactive",
  "Resigned",
  "Terminated",
] as const;

export function isTerminalEmployeeStatus(status: string): boolean {
  return (TERMINAL_EMPLOYEE_STATUSES as readonly string[]).includes(status);
}

/** Prisma `notIn` list for DIRECT-scope queries. */
export function terminalEmployeeStatusesForQuery(): EmployeeStatus[] {
  return [...TERMINAL_EMPLOYEE_STATUSES];
}
