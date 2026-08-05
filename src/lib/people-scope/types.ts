import type { EmployeeStatus } from "@/lib/employee-types";

/** Scope modes supported by PeopleScopeEngine. V1 implements DIRECT only. */
export type PeopleScopeMode = "DIRECT";

export type ResolveScopeOptions = {
  mode?: PeopleScopeMode;
};

export type PeopleScope = {
  mode: PeopleScopeMode;
  /** In-scope employee IDs (DIRECT reports for V1). */
  employeeIds: number[];
  /** Distinct non-null departments among in-scope employees. */
  departments: string[];
};

/**
 * Fields safe for a line manager to see (My Team PRD).
 * Excludes phone, personal contact, address, emergency, payroll, and account secrets.
 */
export type ManagerSafeEmployee = {
  id: number;
  employeeCode: string;
  name: string;
  department: string | null;
  designation: string | null;
  employeeStatus: EmployeeStatus | string;
  isActive: boolean;
  shift: string | null;
  joiningDate: Date;
  workLocation: string | null;
  employmentType: string | null;
};

/** Minimal row shape accepted by {@link toManagerSafeEmployee}. */
export type EmployeeForManagerSafeDto = {
  id: number;
  employeeCode: string;
  name: string;
  department: string | null;
  designation: string | null;
  employeeStatus: string;
  isActive: boolean;
  shift: string | null;
  joiningDate: Date;
  workLocation?: string | null;
  employmentType?: string | null;
  /** Protected — never copied into ManagerSafeEmployee. */
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  dateOfBirth?: Date | null;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
};
