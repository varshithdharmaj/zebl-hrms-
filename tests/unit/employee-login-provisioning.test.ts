import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";

const userFindUnique = vi.fn();
const userCreate = vi.fn();
const userUpdate = vi.fn();
const employeeFindUnique = vi.fn();
const employeeUpdate = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      create: (...args: unknown[]) => userCreate(...args),
      update: (...args: unknown[]) => userUpdate(...args),
    },
    employee: {
      findUnique: (...args: unknown[]) => employeeFindUnique(...args),
      update: (...args: unknown[]) => employeeUpdate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: {
          findUnique: (...args: unknown[]) => userFindUnique(...args),
          create: (...args: unknown[]) => userCreate(...args),
          update: (...args: unknown[]) => userUpdate(...args),
        },
        employee: {
          update: (...args: unknown[]) => employeeUpdate(...args),
        },
      }),
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    USER_LOGIN_CREATED: "user.login.created",
    USER_LOGIN_LINKED: "user.login.linked",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

vi.mock("@/lib/security/request-context", () => ({
  getRequestSecurityContext: async () => ({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/auth", () => ({
  invalidateUserSessions: vi.fn(),
}));

import { provisionEmployeeLogin } from "@/lib/admin/user-management";

const hrActor: SessionUser = {
  id: "hr-1",
  email: "hr@test.local",
  role: "hr",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

const saActor: SessionUser = {
  ...hrActor,
  id: "sa-1",
  email: "sa@test.local",
  role: "super_admin",
};

const employeeActor: SessionUser = {
  ...hrActor,
  id: "emp-1",
  email: "emp@test.local",
  role: "employee",
  employeeId: 1,
};

describe("provisionEmployeeLogin", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userCreate.mockReset();
    userUpdate.mockReset();
    employeeFindUnique.mockReset();
    employeeUpdate.mockReset();
    writeAuditLog.mockReset();
  });

  it("allows HR to create an employee-role login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 10,
      employeeCode: "E-10",
      email: "new@test.local",
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user-new" });

    const result = await provisionEmployeeLogin(hrActor, {
      employeeId: 10,
      mode: "create",
      email: "new@test.local",
      generate: false,
      password: "SecurePass1",
      mustChangePassword: true,
    });

    expect(result.userId).toBe("user-new");
    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@test.local",
        role: "employee",
        employeeId: 10,
        mustChangePassword: true,
        isActive: true,
        accountStatus: "active",
      }),
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.login.created",
        newValue: expect.objectContaining({ role: "employee" }),
        metadata: expect.objectContaining({ operation: "create" }),
      }),
      expect.anything()
    );
  });

  it("honors auditOperation metadata for create callers", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 13,
      employeeCode: "E-13",
      email: "op@test.local",
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user-op" });

    await provisionEmployeeLogin(hrActor, {
      employeeId: 13,
      mode: "create",
      email: "op@test.local",
      generate: false,
      password: "SecurePass1",
      mustChangePassword: true,
      auditOperation: "create_with_employee",
    });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ operation: "create_with_employee" }),
      }),
      expect.anything()
    );
  });

  it("creates inactive login for inactive employee (no usable bypass)", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 12,
      employeeCode: "E-12",
      email: "inactive@test.local",
      employeeStatus: "Inactive",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user-inactive" });

    await provisionEmployeeLogin(hrActor, {
      employeeId: 12,
      mode: "create",
      email: "inactive@test.local",
      generate: true,
      mustChangePassword: true,
    });

    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "employee",
        isActive: false,
        accountStatus: "inactive",
      }),
    });
  });

  it("forces employee role even if elevated intent is attempted via create path", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 11,
      employeeCode: "E-11",
      email: null,
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user-forced" });

    await provisionEmployeeLogin(hrActor, {
      employeeId: 11,
      mode: "create",
      email: "forced@test.local",
      generate: true,
      mustChangePassword: true,
    });

    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "employee" }),
    });
  });

  it("denies employees from provisioning logins", async () => {
    await expect(
      provisionEmployeeLogin(employeeActor, {
        employeeId: 10,
        mode: "create",
        email: "x@test.local",
        generate: true,
        mustChangePassword: true,
      })
    ).rejects.toThrow(/not permitted/);
    expect(employeeFindUnique).not.toHaveBeenCalled();
  });

  it("denies create when employee already has a login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 10,
      employeeCode: "E-10",
      email: "a@test.local",
      user: { id: "existing", role: "employee" },
    });

    await expect(
      provisionEmployeeLogin(hrActor, {
        employeeId: 10,
        mode: "create",
        email: "a@test.local",
        generate: true,
        mustChangePassword: true,
      })
    ).rejects.toThrow(/already has a linked login/);
  });

  it("prevents duplicate email create", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 10,
      employeeCode: "E-10",
      email: null,
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue({ id: "dup", email: "dup@test.local", role: "employee" });

    await expect(
      provisionEmployeeLogin(hrActor, {
        employeeId: 10,
        mode: "create",
        email: "dup@test.local",
        generate: true,
        mustChangePassword: true,
      })
    ).rejects.toThrow(/already exists/);
  });

  it("allows HR to link an unlinked employee-role login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 20,
      employeeCode: "E-20",
      email: null,
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue({
      id: "orphan-user",
      email: "orphan@test.local",
      role: "employee",
      employeeId: null,
    });
    userUpdate.mockResolvedValue({});

    const result = await provisionEmployeeLogin(hrActor, {
      employeeId: 20,
      mode: "link",
      email: "orphan@test.local",
      generate: false,
      mustChangePassword: false,
    });

    expect(result.userId).toBe("orphan-user");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "orphan-user" },
      data: expect.objectContaining({
        employeeId: 20,
        isActive: true,
        accountStatus: "active",
      }),
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.login.linked" }),
      expect.anything()
    );
  });

  it("links login as inactive when employee is terminated", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 24,
      employeeCode: "E-24",
      email: null,
      employeeStatus: "Terminated",
      user: null,
    });
    userFindUnique.mockResolvedValue({
      id: "orphan-term",
      email: "term@test.local",
      role: "employee",
      employeeId: null,
      isActive: true,
    });
    userUpdate.mockResolvedValue({});

    await provisionEmployeeLogin(hrActor, {
      employeeId: 24,
      mode: "link",
      email: "term@test.local",
      generate: false,
      mustChangePassword: false,
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "orphan-term" },
      data: expect.objectContaining({
        isActive: false,
        accountStatus: "terminated",
      }),
    });
  });

  it("denies HR linking an HR-role login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 21,
      employeeCode: "E-21",
      email: null,
      user: null,
    });
    userFindUnique.mockResolvedValue({
      id: "hr-user",
      email: "otherhr@test.local",
      role: "hr",
      employeeId: null,
    });

    await expect(
      provisionEmployeeLogin(hrActor, {
        employeeId: 21,
        mode: "link",
        email: "otherhr@test.local",
        generate: false,
        mustChangePassword: false,
      })
    ).rejects.toThrow(/Only employee-role logins/);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("denies HR linking a Superadmin login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 22,
      employeeCode: "E-22",
      email: null,
      user: null,
    });
    userFindUnique.mockResolvedValue({
      id: "sa-user",
      email: "sa2@test.local",
      role: "super_admin",
      employeeId: null,
    });

    await expect(
      provisionEmployeeLogin(hrActor, {
        employeeId: 22,
        mode: "link",
        email: "sa2@test.local",
        generate: false,
        mustChangePassword: false,
      })
    ).rejects.toThrow(/Only employee-role logins/);
  });

  it("denies linking a login already attached to another employee", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 23,
      employeeCode: "E-23",
      email: null,
      user: null,
    });
    userFindUnique.mockResolvedValue({
      id: "linked-user",
      email: "linked@test.local",
      role: "employee",
      employeeId: 99,
    });

    await expect(
      provisionEmployeeLogin(hrActor, {
        employeeId: 23,
        mode: "link",
        email: "linked@test.local",
        generate: false,
        mustChangePassword: false,
      })
    ).rejects.toThrow(/already linked/);
  });

  it("allows Superadmin to create employee login", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 30,
      employeeCode: "E-30",
      email: "sa-create@test.local",
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "sa-created" });

    await provisionEmployeeLogin(saActor, {
      employeeId: 30,
      mode: "create",
      email: "sa-create@test.local",
      generate: false,
      password: "SecurePass1",
      mustChangePassword: false,
    });

    expect(userCreate).toHaveBeenCalled();
  });

  it("does not store plaintext password in audit metadata", async () => {
    employeeFindUnique.mockResolvedValue({
      id: 40,
      employeeCode: "E-40",
      email: "audit@test.local",
      employeeStatus: "Active",
      user: null,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "audit-user" });

    await provisionEmployeeLogin(hrActor, {
      employeeId: 40,
      mode: "create",
      email: "audit@test.local",
      generate: false,
      password: "PlaintextSecret1",
      mustChangePassword: true,
    });

    const auditPayload = writeAuditLog.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(auditPayload)).not.toContain("PlaintextSecret1");
  });
});

describe("canAdministerEmployeeAccount — protected boundary (policy)", () => {
  it("HR cannot administer HR or Superadmin targets", async () => {
    const { canAdministerEmployeeAccount } = await import("@/lib/permissions");
    expect(canAdministerEmployeeAccount("hr", "employee")).toBe(true);
    expect(canAdministerEmployeeAccount("hr", "hr")).toBe(false);
    expect(canAdministerEmployeeAccount("hr", "super_admin")).toBe(false);
    expect(canAdministerEmployeeAccount("super_admin", "hr")).toBe(true);
    expect(canAdministerEmployeeAccount("super_admin", "super_admin")).toBe(true);
  });
});
