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
    recruitmentOpsAccess: false,
  };
}

/** Seeded Manager 1 — employee + hierarchy + recruitmentOpsAccess. */
export function mockTestManager1Session(employeeId = 101): SessionUser {
  return {
    ...base,
    id: "mgr1-test",
    email: "mgr1.test@zebl.local",
    role: "employee",
    employeeId,
    employeeName: "Test Manager One",
    recruitmentOpsAccess: true,
  };
}

/** Seeded Manager 2 — employee + hierarchy + recruitmentOpsAccess. */
export function mockTestManager2Session(employeeId = 102): SessionUser {
  return {
    ...base,
    id: "mgr2-test",
    email: "mgr2.test@zebl.local",
    role: "employee",
    employeeId,
    employeeName: "Test Manager Two",
    recruitmentOpsAccess: true,
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
    recruitmentOpsAccess: false,
  };
}
