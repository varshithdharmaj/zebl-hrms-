import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const { candidateFindUnique, tagUpsert, candidateTagUpsert, candidateTagDeleteMany } = vi.hoisted(
  () => ({
    candidateFindUnique: vi.fn(async () => ({ id: "cand-1", deletedAt: null })),
    tagUpsert: vi.fn(async ({ where }: { where: { name: string } }) => ({
      id: "tag-1",
      name: where.name,
      color: null,
    })),
    candidateTagUpsert: vi.fn(async () => ({})),
    candidateTagDeleteMany: vi.fn(async () => ({ count: 1 })),
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    candidate: { findUnique: candidateFindUnique },
    recruitmentTag: { upsert: tagUpsert, findMany: vi.fn(async () => []) },
    candidateTag: {
      upsert: candidateTagUpsert,
      deleteMany: candidateTagDeleteMany,
      findMany: vi.fn(async () => []),
    },
  },
}));

import { createTagService } from "@/lib/recruitment/tags/tag-service";

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

const employeeSession: SessionUser = { ...hrSession, id: "user-emp", role: "employee" };

describe("TagService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    candidateFindUnique.mockResolvedValue({ id: "cand-1", deletedAt: null });
    tagUpsert.mockImplementation(async ({ where }: { where: { name: string } }) => ({
      id: "tag-1",
      name: where.name,
      color: null,
    }));
  });

  it("finds-or-creates the tag by name and attaches it to the candidate", async () => {
    const service = createTagService();
    const tag = await service.addCandidateTag(hrSession, {
      candidateId: "cand-1",
      tagName: "  Strong Profile  ",
    });

    expect(tag).toEqual({ id: "tag-1", name: "Strong Profile", color: null });
    expect(tagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "Strong Profile" } })
    );
    expect(candidateTagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateId_tagId: { candidateId: "cand-1", tagId: "tag-1" } },
      })
    );
  });

  it("rejects a blank tag name", async () => {
    const service = createTagService();
    await expect(
      service.addCandidateTag(hrSession, { candidateId: "cand-1", tagName: "   " })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
    expect(tagUpsert).not.toHaveBeenCalled();
  });

  it("blocks tagging for non-HR/admin sessions", async () => {
    const service = createTagService();
    await expect(
      service.addCandidateTag(employeeSession, { candidateId: "cand-1", tagName: "Priority" })
    ).rejects.toThrow();
    expect(tagUpsert).not.toHaveBeenCalled();
  });

  it("404s when the candidate does not exist", async () => {
    candidateFindUnique.mockResolvedValue(null);
    const service = createTagService();
    await expect(
      service.addCandidateTag(hrSession, { candidateId: "missing", tagName: "Priority" })
    ).rejects.toMatchObject({ code: "REC_NOT_FOUND" });
  });

  it("removes a tag from a candidate", async () => {
    const service = createTagService();
    await service.removeCandidateTag(hrSession, { candidateId: "cand-1", tagId: "tag-1" });
    expect(candidateTagDeleteMany).toHaveBeenCalledWith({
      where: { candidateId: "cand-1", tagId: "tag-1" },
    });
  });

  it("blocks tag removal for non-HR/admin sessions", async () => {
    const service = createTagService();
    await expect(
      service.removeCandidateTag(employeeSession, { candidateId: "cand-1", tagId: "tag-1" })
    ).rejects.toThrow();
    expect(candidateTagDeleteMany).not.toHaveBeenCalled();
  });
});
