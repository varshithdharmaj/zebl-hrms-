import { beforeEach, describe, expect, it, vi } from "vitest";

const employeeCreate = vi.fn();
const employeeFindUnique = vi.fn();
const userFindUnique = vi.fn();
const writeAuditLog = vi.fn();
const initializeBalances = vi.fn();
const provisionEmployeeLogin = vi.fn();
const requireManageEmployeeSession = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      create: (...args: unknown[]) => employeeCreate(...args),
      findUnique: (...args: unknown[]) => employeeFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/auth-guards", () => ({
  requireManageEmployeeSession: (...args: unknown[]) =>
    requireManageEmployeeSession(...args),
}));

vi.mock("@/lib/leave", () => ({
  initializeEmployeeLeaveBalances: (...args: unknown[]) => initializeBalances(...args),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { EMPLOYEE_CREATED: "employee.created" },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/admin/user-management", () => {
  class UserManagementError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UserManagementError";
    }
  }
  return {
    provisionEmployeeLogin: (...args: unknown[]) => provisionEmployeeLogin(...args),
    UserManagementError,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createEmployeeAction } from "@/actions/employees";
import { UserManagementError } from "@/lib/admin/user-management";

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("createEmployeeAction — canonical login provisioning", () => {
  beforeEach(() => {
    employeeCreate.mockReset();
    employeeFindUnique.mockReset();
    userFindUnique.mockReset();
    writeAuditLog.mockReset();
    initializeBalances.mockReset();
    provisionEmployeeLogin.mockReset();
    requireManageEmployeeSession.mockResolvedValue({
      id: "hr-1",
      email: "hr@test.local",
      role: "hr",
      employeeId: null,
    });
    employeeFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(null);
    employeeCreate.mockResolvedValue({
      id: 99,
      employeeCode: "E-99",
      employeeStatus: "Active",
    });
    initializeBalances.mockResolvedValue(undefined);
    writeAuditLog.mockResolvedValue(undefined);
  });

  it("creates employee without login when createLogin is off", async () => {
    const result = await createEmployeeAction(
      {},
      form({
        employeeCode: "E-99",
        name: "Test User",
        joiningDate: "2026-01-01",
        employeeStatus: "Active",
      })
    );

    expect(result.success).toMatch(/created successfully/i);
    expect(provisionEmployeeLogin).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "employee.created",
        metadata: expect.objectContaining({ loginCreated: false }),
      })
    );
  });

  it("routes optional login through provisionEmployeeLogin once", async () => {
    provisionEmployeeLogin.mockResolvedValue({ userId: "user-99" });

    const result = await createEmployeeAction(
      {},
      form({
        employeeCode: "E-99",
        name: "Test User",
        email: "test@zebl.com",
        joiningDate: "2026-01-01",
        employeeStatus: "Active",
        createLogin: "on",
        password: "SecurePass1",
      })
    );

    expect(result.success).toMatch(/created successfully/i);
    expect(result.error).toBeUndefined();
    expect(provisionEmployeeLogin).toHaveBeenCalledTimes(1);
    expect(provisionEmployeeLogin).toHaveBeenCalledWith(
      expect.objectContaining({ role: "hr" }),
      expect.objectContaining({
        employeeId: 99,
        mode: "create",
        email: "test@zebl.com",
        password: "SecurePass1",
        generate: false,
        mustChangePassword: true,
        auditOperation: "create_with_employee",
      })
    );
    // Single employee.created audit — login audit owned by provisioner
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ loginCreated: true }),
      })
    );
  });

  it("keeps employee when login provisioning fails and surfaces warning", async () => {
    provisionEmployeeLogin.mockRejectedValue(
      new UserManagementError("A login with this email already exists.")
    );

    const result = await createEmployeeAction(
      {},
      form({
        employeeCode: "E-99",
        name: "Test User",
        email: "dup@zebl.com",
        joiningDate: "2026-01-01",
        employeeStatus: "Active",
        createLogin: "on",
        password: "SecurePass1",
      })
    );

    expect(employeeCreate).toHaveBeenCalled();
    expect(result.success).toMatch(/login was not created/i);
    expect(result.error).toMatch(/already exists/i);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ loginCreated: false }),
      })
    );
  });
});
