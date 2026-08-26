import type { SessionUser } from "@/lib/session";

const base = {
  sessionVersion: 1,
  authProvider: "local" as const,
  employeeName: null,
};

export function mockAdminSession(overrides?: Partial<SessionUser>): SessionUser {
  return {
    ...base,
    id: "1",
    email: "admin@test.local",
    role: "admin",
    employeeId: null,
    ...overrides,
  };
}

export function mockManagerSession(employeeId = 10): SessionUser {
  return {
    ...base,
    id: "2",
    email: "manager@test.local",
    role: "manager",
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
