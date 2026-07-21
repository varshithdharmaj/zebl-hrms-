export const EMPLOYEE_STATUSES = ["Active", "Inactive", "Resigned", "Terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export function isValidEmployeeStatus(value: string): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.includes(value as EmployeeStatus);
}

export function statusToIsActive(status: EmployeeStatus): boolean {
  return status === "Active";
}

export type EmployeeProfile = {
  id: number;
  employeeCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  shift: string | null;
  joiningDate: Date;
  employeeStatus: EmployeeStatus;
  isActive: boolean;
  user: { email: string } | null;
};
