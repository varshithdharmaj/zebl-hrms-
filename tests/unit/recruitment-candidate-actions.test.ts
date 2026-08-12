import { describe, expect, it, vi, beforeEach } from "vitest";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

const createMock = vi.fn(async () => ({ id: "cand-1" }));
const updateMock = vi.fn(async () => undefined);
const archiveMock = vi.fn(async () => undefined);
const restoreMock = vi.fn(async () => undefined);
const mergeMock = vi.fn(async () => undefined);
const getMock = vi.fn(async () => ({ id: "cand-1", fullName: "John Doe" }));
const listMock = vi.fn(async () => ({ items: [], total: 0 }));
const searchMock = vi.fn(async () => ({ items: [], total: 0 }));

let mockModuleEnabled = true;

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => mockModuleEnabled,
}));

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
  getSessionOrThrow: vi.fn(async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR",
    sessionVersion: 1,
  })),
}));

vi.mock("@/lib/recruitment/services/candidate-service", () => ({
  createCandidateService: () => ({
    createCandidate: (...args: any[]) => (createMock as any)(...args),
    updateCandidate: (...args: any[]) => (updateMock as any)(...args),
    archiveCandidate: (...args: any[]) => (archiveMock as any)(...args),
    restoreCandidate: (...args: any[]) => (restoreMock as any)(...args),
    mergeCandidate: (...args: any[]) => (mergeMock as any)(...args),
    getCandidate: (...args: any[]) => (getMock as any)(...args),
    listCandidates: (...args: any[]) => (listMock as any)(...args),
    searchCandidates: (...args: any[]) => (searchMock as any)(...args),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createCandidateAction,
  updateCandidateAction,
  archiveCandidateAction,
  restoreCandidateAction,
  mergeCandidateAction,
  getCandidateAction,
  listCandidatesAction,
  searchCandidatesAction,
} from "@/actions/recruitment-candidates";

describe("recruitment candidate actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModuleEnabled = true;
  });

  it("createCandidateAction validates, checks permissions and creates", async () => {
    const payload = {
      fullName: "John Doe",
      email: "john.doe@example.com",
    };
    const result = await createCandidateAction({}, payload);
    expect(result.success).toMatch(/created/i);
    expect(result.candidateId).toBe("cand-1");
    expect(createMock).toHaveBeenCalled();
  });

  it("createCandidateAction handles FormData", async () => {
    const fd = new FormData();
    fd.set("fullName", "Jane Doe");
    fd.set("email", "jane.doe@example.com");
    const result = await createCandidateAction({}, fd);
    expect(result.success).toMatch(/created/i);
    expect(createMock).toHaveBeenCalled();
  });

  it("createCandidateAction returns validation error for invalid input", async () => {
    const payload = {
      fullName: "J", // too short
    };
    const result = await createCandidateAction({}, payload);
    expect(result.error).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("createCandidateAction returns error when feature flag is disabled", async () => {
    mockModuleEnabled = false;
    const payload = {
      fullName: "John Doe",
    };
    const result = await createCandidateAction({}, payload);
    expect(result.error).toMatch(/disabled/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("createCandidateAction handles duplicate candidate conflict error", async () => {
    createMock.mockRejectedValueOnce(
      new RecruitmentDomainError(
        "REC_CONFLICT",
        "Candidate with this email already exists.",
        { duplicateCandidateId: "cand-existing" }
      )
    );
    const payload = {
      fullName: "John Doe",
      email: "john.doe@example.com",
    };
    const result = await createCandidateAction({}, payload);
    expect(result.error).toMatch(/already exists/i);
    expect(result.duplicateCandidateId).toBe("cand-existing");
  });

  it("updateCandidateAction validates and updates", async () => {
    const payload = {
      id: "cand-1",
      fullName: "John Updated",
    };
    const result = await updateCandidateAction({}, payload);
    expect(result.success).toMatch(/updated/i);
    expect(updateMock).toHaveBeenCalled();
  });

  it("archiveCandidateAction archives candidate", async () => {
    const result = await archiveCandidateAction({}, { id: "cand-1" });
    expect(result.success).toMatch(/archived/i);
    expect(archiveMock).toHaveBeenCalledWith(expect.anything(), "cand-1");
  });

  it("restoreCandidateAction restores candidate", async () => {
    const result = await restoreCandidateAction({}, { id: "cand-1" });
    expect(result.success).toMatch(/restored/i);
    expect(restoreMock).toHaveBeenCalledWith(expect.anything(), "cand-1");
  });

  it("mergeCandidateAction merges candidates", async () => {
    const result = await mergeCandidateAction({}, { sourceId: "cand-source", targetId: "cand-target" });
    expect(result.success).toMatch(/merged/i);
    expect(mergeMock).toHaveBeenCalledWith(expect.anything(), "cand-source", "cand-target");
  });

  it("getCandidateAction gets candidate details", async () => {
    const result = await getCandidateAction("cand-1");
    expect(result.success).toBe("OK");
    expect((result as any).candidate).toEqual({ id: "cand-1", fullName: "John Doe" });
    expect(getMock).toHaveBeenCalledWith(expect.anything(), "cand-1");
  });

  it("listCandidatesAction lists candidates", async () => {
    const result = await listCandidatesAction({ status: "active", page: 1, pageSize: 10 });
    expect(result.success).toBe("OK");
    expect(listMock).toHaveBeenCalled();
  });

  it("searchCandidatesAction searches candidates", async () => {
    const result = await searchCandidatesAction({ query: "John", page: 1, pageSize: 10 });
    expect(result.success).toBe("OK");
    expect(searchMock).toHaveBeenCalled();
  });
});
