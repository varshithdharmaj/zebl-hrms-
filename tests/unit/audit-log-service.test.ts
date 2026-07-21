import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("AuditLogService foundation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists reusable module, change-set and request context fields", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await writeAuditLog({
      entityType: "employee",
      entityId: "42",
      action: "employee.department.changed",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
      employeeId: 42,
      module: "employees",
      description: "Department changed.",
      oldValue: { department: "Sales" },
      newValue: { department: "Operations" },
      metadata: { source: "unit-test" },
      requestContext: {
        ipAddress: "192.0.2.10",
        browser: "Chrome",
        device: "Desktop",
        operatingSystem: "Windows",
        userAgent: "test-agent",
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 42,
        module: "employees",
        oldValue: { department: "Sales" },
        newValue: { department: "Operations" },
        ipAddress: "192.0.2.10",
        metadata: JSON.stringify({ source: "unit-test" }),
      }),
    });
  });
});
