import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn(async () => ({ jobId: "job-1" }));
const updateMock = vi.fn(async () => undefined);
const archiveMock = vi.fn(async () => undefined);
const closeMock = vi.fn(async () => undefined);
const reopenMock = vi.fn(async () => undefined);

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: vi.fn(async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR",
    sessionVersion: 1,
  })),
  requireRecruitmentAdminSession: vi.fn(async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR",
    sessionVersion: 1,
  })),
}));

vi.mock("@/lib/recruitment/job/job-opening-service", () => ({
  JobOpeningService: {
    create: (...args: unknown[]) => createMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    archive: (...args: unknown[]) => archiveMock(...args),
    close: (...args: unknown[]) => closeMock(...args),
    reopen: (...args: unknown[]) => reopenMock(...args),
    get: vi.fn(),
    list: vi.fn(),
    changeStatus: vi.fn(),
    addHiringTeamMember: vi.fn(),
    removeHiringTeamMember: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

import {
  archiveJobOpeningAction,
  closeJobOpeningAction,
  createJobOpeningAction,
} from "@/actions/recruitment-jobs";

describe("recruitment job actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createJobOpeningAction validates and creates", async () => {
    const fd = new FormData();
    fd.set("title", "Platform Engineer");
    fd.set("openingsCount", "1");
    fd.set("employmentType", "full_time");
    await expect(createJobOpeningAction({}, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(createMock).toHaveBeenCalled();
  });

  it("createJobOpeningAction returns validation error", async () => {
    const fd = new FormData();
    fd.set("title", "A");
    fd.set("openingsCount", "0");
    fd.set("employmentType", "full_time");
    const result = await createJobOpeningAction({}, fd);
    expect(result.error).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("closeJobOpeningAction requires reason", async () => {
    const fd = new FormData();
    fd.set("id", "job-1");
    fd.set("reason", "");
    const result = await closeJobOpeningAction({}, fd);
    expect(result.error).toBeTruthy();
    expect(closeMock).not.toHaveBeenCalled();
  });

  it("archiveJobOpeningAction archives", async () => {
    const fd = new FormData();
    fd.set("id", "job-1");
    const result = await archiveJobOpeningAction({}, fd);
    expect(result.success).toMatch(/archived/i);
    expect(archiveMock).toHaveBeenCalled();
  });
});
