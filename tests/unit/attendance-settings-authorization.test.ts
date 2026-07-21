import { describe, expect, it, vi, beforeEach } from "vitest";
import { PermissionError } from "@/lib/permissions";

const requireSuperAdminSession = vi.fn();
const upsert = vi.fn();
const create = vi.fn();
const deleteFn = vi.fn();
const findUnique = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth-guards", () => ({
  requireSuperAdminSession: () => requireSuperAdminSession(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendanceSettings: { upsert: (...args: unknown[]) => upsert(...args) },
    attendanceDateOverride: {
      create: (...args: unknown[]) => create(...args),
      delete: (...args: unknown[]) => deleteFn(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    ATTENDANCE_SETTINGS_UPDATED: "attendance.settings.updated",
    ATTENDANCE_DATE_OVERRIDE_CREATED: "attendance.date_override.created",
    ATTENDANCE_DATE_OVERRIDE_REMOVED: "attendance.date_override.removed",
  },
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

import {
  updateWeeklyScheduleAction,
  createDateOverrideAction,
  removeDateOverrideAction,
} from "@/actions/attendance-settings";

const actor = { id: "actor-1", email: "actor@test.local" };

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    // Mirror real browser behavior: an unchecked checkbox is absent from FormData,
    // never submitted as an empty string.
    if (value !== "") fd.set(key, value);
  }
  return fd;
}

describe("attendance settings actions — authorization", () => {
  beforeEach(() => {
    requireSuperAdminSession.mockReset();
    upsert.mockReset();
    create.mockReset();
    deleteFn.mockReset();
    findUnique.mockReset();
    writeAuditLog.mockReset();
  });

  it("blocks HR/employee from updating the weekly schedule", async () => {
    requireSuperAdminSession.mockRejectedValue(new PermissionError());

    const result = await updateWeeklyScheduleAction(
      {},
      formData({ mondayWorking: "on", expectedWorkMinutes: "480" })
    );

    expect(result.error).toMatch(/Super Admin/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("allows Super Admin to update the weekly schedule", async () => {
    requireSuperAdminSession.mockResolvedValue(actor);
    upsert.mockResolvedValue({});

    const result = await updateWeeklyScheduleAction(
      {},
      formData({
        mondayWorking: "on",
        tuesdayWorking: "on",
        wednesdayWorking: "on",
        thursdayWorking: "on",
        fridayWorking: "on",
        saturdayWorking: "",
        sundayWorking: "",
        expectedWorkMinutes: "480",
      })
    );

    expect(result.success).toBeDefined();
    expect(upsert).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("blocks HR/employee from creating a date override", async () => {
    requireSuperAdminSession.mockRejectedValue(new PermissionError());

    const result = await createDateOverrideAction(
      {},
      formData({ date: "2026-07-25", type: "working_day" })
    );

    expect(result.error).toMatch(/Super Admin/);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows Super Admin to create a date override", async () => {
    requireSuperAdminSession.mockResolvedValue(actor);
    create.mockResolvedValue({ id: 1 });

    const result = await createDateOverrideAction(
      {},
      formData({ date: "2026-07-25", type: "working_day", reason: "Client deadline" })
    );

    expect(result.success).toBeDefined();
    expect(create).toHaveBeenCalled();
  });

  it("blocks HR/employee from removing a date override", async () => {
    requireSuperAdminSession.mockRejectedValue(new PermissionError());

    const result = await removeDateOverrideAction({}, formData({ id: "1" }));

    expect(result.error).toMatch(/Super Admin/);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("allows Super Admin to remove a date override", async () => {
    requireSuperAdminSession.mockResolvedValue(actor);
    findUnique.mockResolvedValue({ id: 1, date: new Date("2026-07-25"), type: "working_day" });
    deleteFn.mockResolvedValue({});

    const result = await removeDateOverrideAction({}, formData({ id: "1" }));

    expect(result.success).toBeDefined();
    expect(deleteFn).toHaveBeenCalled();
  });
});
