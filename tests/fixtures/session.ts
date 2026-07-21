import type { SessionUser } from "@/lib/session";

const base = {
  sessionVersion: 1,
  authProvider: "local" as const,
  employeeName: null,
};

export function mockSuperAdminSession(overrides?: Partial<SessionUser>): SessionUser {
  return {
    ...base,
    id: "1",
    email: "superadmin@test.local",
    role: "super_admin",
    employeeId: null,
    ...overrides,
  };
}

/** @deprecated use {@link mockSuperAdminSession} — kept as an alias for existing tests. */
export const mockAdminSession = mockSuperAdminSession;

export function mockHrSession(overrides?: Partial<SessionUser>): SessionUser {
  return {
    ...base,
    id: "4",
    email: "hr@test.local",
    role: "hr",
    employeeId: null,
    ...overrides,
  };
}

/** A line-manager: an employee (role) who is an approver via the org hierarchy. */
export function mockManagerSession(employeeId = 10): SessionUser {
  return {
    ...base,
    id: "2",
    email: "manager@test.local",
    role: "employee",
    employeeId,
    employeeName: "Test Manager",
  };
}

export function mockEmployeeSession(employeeId = 20): SessionUser {
  return {
    ...base,
    id: "3",
    email: "employee@test.local",
    role: "employee",
    employeeId,
    employeeName: "Test Employee",
  };
}
