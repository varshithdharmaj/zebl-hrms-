import { describe, expect, it, vi, beforeEach } from "vitest";

const findByNormalizedEmail = vi.fn();
const findByNormalizedPhone = vi.fn();

vi.mock("@/lib/recruitment/repositories/prisma-candidate-repository", () => ({
  prismaCandidateRepository: {
    findByNormalizedEmail: (...args: unknown[]) => findByNormalizedEmail(...args),
    findByNormalizedPhone: (...args: unknown[]) => findByNormalizedPhone(...args),
  },
}));

import { resolveCandidateForPublicApplication } from "@/lib/recruitment/public-apply/candidate-resolution";

describe("resolveCandidateForPublicApplication", () => {
  beforeEach(() => {
    findByNormalizedEmail.mockReset();
    findByNormalizedPhone.mockReset();
  });

  it("reuses an existing candidate on exact email match", async () => {
    findByNormalizedEmail.mockResolvedValue({ id: "cand-1", deletedAt: null });
    const result = await resolveCandidateForPublicApplication({
      email: "Jane@Example.com",
      phone: "+919876543210",
    });
    expect(result).toEqual({ kind: "reuse", candidateId: "cand-1" });
    expect(findByNormalizedEmail).toHaveBeenCalledWith("jane@example.com");
    // Email matched — phone lookup must not even run (email is the higher-priority signal).
    expect(findByNormalizedPhone).not.toHaveBeenCalled();
  });

  it("never reuses a soft-deleted candidate on email match", async () => {
    findByNormalizedEmail.mockResolvedValue({ id: "cand-1", deletedAt: new Date() });
    findByNormalizedPhone.mockResolvedValue(null);
    const result = await resolveCandidateForPublicApplication({
      email: "jane@example.com",
      phone: null,
    });
    expect(result.kind).toBe("create");
  });

  it("flags a phone-only match for HR review without auto-merging", async () => {
    findByNormalizedEmail.mockResolvedValue(null);
    findByNormalizedPhone.mockResolvedValue({ id: "cand-9", deletedAt: null });
    const result = await resolveCandidateForPublicApplication({
      email: "new-person@example.com",
      phone: "+919876543210",
    });
    expect(result).toEqual({
      kind: "create",
      duplicateOfCandidateId: "cand-9",
      duplicateConfidence: 0.5,
    });
  });

  it("creates cleanly with no duplicate signal when nothing matches", async () => {
    findByNormalizedEmail.mockResolvedValue(null);
    findByNormalizedPhone.mockResolvedValue(null);
    const result = await resolveCandidateForPublicApplication({
      email: "nobody@example.com",
      phone: "+911111111111",
    });
    expect(result).toEqual({
      kind: "create",
      duplicateOfCandidateId: null,
      duplicateConfidence: null,
    });
  });
});
