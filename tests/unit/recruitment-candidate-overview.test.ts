import { describe, expect, it, vi } from "vitest";
import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import { OVERVIEW_NOTES_LIMIT } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import { createCandidateAiEnrichmentService } from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import { createCandidateAiRecoveryService } from "@/lib/recruitment/services/candidate-ai-recovery-service";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { PermissionError } from "@/lib/permissions";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import type { SessionUser } from "@/lib/session";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recruitment/permissions/recruitment-scope-engine")
  >("@/lib/recruitment/permissions/recruitment-scope-engine");
  return {
    ...actual,
    RecruitmentScopeEngine: {
      ...actual.RecruitmentScopeEngine,
      canViewCandidate: vi.fn(async () => true),
    },
  };
});

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("candidate overview projection", () => {
  it("exports a bounded overview notes limit of 50", () => {
    expect(OVERVIEW_NOTES_LIMIT).toBe(50);
  });

  it("getCandidateOverview delegates to repository overview loader", async () => {
    const getCandidateOverview = vi.fn(async () => ({
      id: "cand-1",
      fullName: "Jane Doe",
      documents: [],
      documentCount: 3,
      primaryRecruiterName: "Recruiter One",
      notes: [],
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      certifications: [],
    }));

    const service = createCandidateService({
      getCandidateOverview,
    } as unknown as CandidateRepository);

    const result = await service.getCandidateOverview(hrSession, "cand-1");
    expect(getCandidateOverview).toHaveBeenCalledWith("cand-1");
    expect(result.documentCount).toBe(3);
    expect(result.primaryRecruiterName).toBe("Recruiter One");
    expect(result.documents).toEqual([]);
  });

  it("getCandidateOverview rejects out-of-scope candidates", async () => {
    const { RecruitmentScopeEngine } = await import(
      "@/lib/recruitment/permissions/recruitment-scope-engine"
    );
    vi.mocked(RecruitmentScopeEngine.canViewCandidate).mockResolvedValueOnce(false);

    const service = createCandidateService({} as unknown as CandidateRepository);
    await expect(service.getCandidateOverview(hrSession, "cand-x")).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it("getCandidateTimeline rejects out-of-scope candidates", async () => {
    const { RecruitmentScopeEngine } = await import(
      "@/lib/recruitment/permissions/recruitment-scope-engine"
    );
    vi.mocked(RecruitmentScopeEngine.canViewCandidate).mockResolvedValueOnce(false);

    const service = createCandidateService({} as unknown as CandidateRepository);
    await expect(service.getCandidateTimeline(hrSession, "cand-x", 50)).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it("listResumeParseDrafts requires candidate visibility", async () => {
    const findResumeParseDrafts = vi.fn(async () => [{ id: "draft-1", contentJson: {} }]);
    const service = createCandidateService({
      findResumeParseDrafts,
    } as unknown as CandidateRepository);

    const rows = await service.listResumeParseDrafts(hrSession, "cand-1");
    expect(findResumeParseDrafts).toHaveBeenCalledWith("cand-1", 5);
    expect(rows).toHaveLength(1);
  });

  it("getResumeParseDraft rejects drafts for other candidates", async () => {
    const getInsight = vi.fn(async () => ({
      id: "draft-1",
      candidateId: "other",
      insightType: "resume_parse",
      contentJson: {},
    }));
    const service = createCandidateService({
      getInsight,
    } as unknown as CandidateRepository);

    const row = await service.getResumeParseDraft(hrSession, "cand-1", "draft-1");
    expect(row).toBeNull();
  });
});

describe("bounded AI insight lookup", () => {
  it("listLatestEnrichment uses findReviewableInsights with status filter", async () => {
    const findReviewableInsights = vi.fn(async () => []);

    const service = createCandidateAiEnrichmentService({
      findReviewableInsights,
    } as unknown as CandidateRepository);

    await service.listLatestEnrichment("cand-1");
    expect(findReviewableInsights).toHaveBeenCalledWith("cand-1", {
      insightType: AiInsightType.candidate_summary,
      statuses: [AiInsightStatus.pending_review, AiInsightStatus.accepted],
    });
  });

  it("listLatestRecovery uses findReviewableInsights with status filter", async () => {
    const findReviewableInsights = vi.fn(async () => []);

    const service = createCandidateAiRecoveryService({
      findReviewableInsights,
    } as unknown as CandidateRepository);

    await service.listLatestRecovery("cand-1");
    expect(findReviewableInsights).toHaveBeenCalledWith("cand-1", {
      insightType: AiInsightType.resume_field_recovery,
      statuses: [AiInsightStatus.pending_review, AiInsightStatus.accepted],
    });
  });
});
