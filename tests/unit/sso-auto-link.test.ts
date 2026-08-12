import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUnique = vi.fn();
const userFindFirst = vi.fn();
const userCreate = vi.fn();
const userUpdate = vi.fn();
const employeeFindFirst = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      findFirst: (...args: unknown[]) => userFindFirst(...args),
      create: (...args: unknown[]) => userCreate(...args),
      update: (...args: unknown[]) => userUpdate(...args),
    },
    employee: {
      findFirst: (...args: unknown[]) => employeeFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: { AUTH_SSO_ACCOUNT_LINKED: "auth.sso.linked" },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

const autoLink = { enabled: false };
const autoProvision = { enabled: false };

vi.mock("@/lib/auth/auth-config", () => ({
  isSsoAutoLinkEnabled: () => autoLink.enabled,
  isSsoAutoProvisionEnabled: () => autoProvision.enabled,
}));

vi.mock("@/lib/auth/role-mapping", () => ({
  resolveRoleForMicrosoftSignIn: () => "employee",
}));

import { provisionMicrosoftUser } from "@/lib/auth/user-provisioning";

const claims = {
  oid: "oid-1",
  sub: "sub-1",
  tid: "tenant-1",
  email: "jane@zebl.com",
  preferred_username: "jane@zebl.com",
  name: "Jane",
};

describe("SSO AUTH_SSO_AUTO_LINK", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userFindFirst.mockReset();
    userCreate.mockReset();
    userUpdate.mockReset();
    employeeFindFirst.mockReset();
    writeAuditLog.mockReset();
    autoLink.enabled = false;
    autoProvision.enabled = false;
  });

  it("does not attach employeeId when auto-link is disabled", async () => {
    userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-1",
        email: "jane@zebl.com",
        azureOid: null,
        employeeId: null,
        isActive: true,
        employee: null,
        profilePhotoUrl: null,
      });
    employeeFindFirst.mockResolvedValue({
      id: 42,
      email: "jane@zebl.com",
      isActive: true,
      employeeStatus: "Active",
    });
    userUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "user-1",
      email: "jane@zebl.com",
      isActive: true,
      employeeId: data.employeeId ?? null,
      employee: null,
      azureOid: data.azureOid ?? null,
    }));

    const result = await provisionMicrosoftUser({
      claims,
      tenantId: "tenant-1",
      correlationId: "c1",
    });

    expect(result.ok).toBe(true);
    const updateData = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.employeeId).toBeUndefined();
    expect(updateData.azureOid).toBeUndefined();
  });

  it("attaches employeeId when auto-link is enabled", async () => {
    autoLink.enabled = true;
    userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user-1",
        email: "jane@zebl.com",
        azureOid: null,
        employeeId: null,
        isActive: true,
        employee: null,
        profilePhotoUrl: null,
      });
    employeeFindFirst.mockResolvedValue({
      id: 42,
      email: "jane@zebl.com",
      isActive: true,
      employeeStatus: "Active",
    });
    userUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "user-1",
      email: "jane@zebl.com",
      isActive: true,
      employeeId: data.employeeId ?? null,
      employee: data.employeeId ? { id: 42, employeeStatus: "Active", isActive: true } : null,
      azureOid: data.azureOid ?? null,
    }));

    const result = await provisionMicrosoftUser({
      claims,
      tenantId: "tenant-1",
      correlationId: "c1",
    });

    expect(result.ok).toBe(true);
    const updateData = userUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.employeeId).toBe(42);
  });

  it("lets an already-linked user authenticate without re-linking", async () => {
    userFindUnique
      .mockResolvedValueOnce({ id: "user-1", email: "jane@zebl.com" })
      .mockResolvedValueOnce({
        id: "user-1",
        email: "jane@zebl.com",
        azureOid: "oid-1",
        employeeId: 42,
        isActive: true,
        employee: { id: 42, employeeStatus: "Active", isActive: true },
        profilePhotoUrl: null,
      });
    userUpdate.mockResolvedValue({
      id: "user-1",
      email: "jane@zebl.com",
      isActive: true,
      employeeId: 42,
      employee: { id: 42, employeeStatus: "Active", isActive: true },
    });

    const result = await provisionMicrosoftUser({
      claims,
      tenantId: "tenant-1",
      correlationId: "c1",
    });

    expect(result.ok).toBe(true);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("rejects unknown SSO emails when auto-provision is off", async () => {
    userFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    employeeFindFirst.mockResolvedValue(null);

    const result = await provisionMicrosoftUser({
      claims,
      tenantId: "tenant-1",
      correlationId: "c1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown_user");
    expect(userCreate).not.toHaveBeenCalled();
  });
});
