import type { EmployeeForManagerSafeDto, ManagerSafeEmployee } from "@/lib/people-scope/types";

/**
 * Maps an employee record to the manager-safe projection.
 * Explicit allowlist — protected HR fields are never copied.
 */
export function toManagerSafeEmployee(employee: EmployeeForManagerSafeDto): ManagerSafeEmployee {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    department: employee.department,
    designation: employee.designation,
    employeeStatus: employee.employeeStatus,
    isActive: employee.isActive,
    shift: employee.shift,
    joiningDate: employee.joiningDate,
    workLocation: employee.workLocation ?? null,
    employmentType: employee.employmentType ?? null,
  };
}
