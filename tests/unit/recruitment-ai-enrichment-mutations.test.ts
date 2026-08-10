import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import { PermissionError } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  CANDIDATE_ENRICHMENT_CONTENT_KIND,
  CANDIDATE_ENRICHMENT_PROMPT_VERSION,
} from "@/lib/recruitment/ai/types";
import { computeCandidateFieldStatus } from "@/lib/recruitment/ai/field-status";
import { computeEnrichmentInputFingerprint } from "@/lib/recruitment/ai/enrichment-fingerprint";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { CandidateAiEnrichmentService } from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import {
  ENRICHMENT_STALE_ACCEPT_MESSAGE,
} from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => {
    const events: unknown[] = [];
    return {
      enqueue: (e: unknown) => events.push(e),
      flush: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
}));

const insightUpdate = vi.fn(async () => undefined);

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(
    work: (tx: {
      $executeRaw: ReturnType<typeof vi.fn>;
      candidateAiInsight: { update: typeof insightUpdate };
    }) => Promise<T>
  ) =>
    work({
      $executeRaw: vi.fn(async () => undefined),
      candidateAiInsight: { update: insightUpdate },
    }),
}));

vi.mock("@/lib/recruitment/repositories/prisma-timeline-repository", () => ({
  prismaTimelineProjectionRepository: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/ai/config", () => ({
  getAiRuntimeConfig: async () => ({
    enabled: true,
    apiKey: "test-key",
    model: "gemini-test",
    reasonDisabled: null,
  }),
  getGeminiApiKey: () => "test-key",
  getGeminiModel: () => "gemini-test",
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const authMocks = vi.hoisted(() => ({
  requireHROrSuperAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: (...args: unknown[]) =>
    authMocks.requireHROrSuperAdminSession(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Employee",
};

function baseCandidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    id: "cand-1",
    tenantId: null,
    fullName: "Alex Candidate",
    firstName: "Alex",
    lastName: "Candidate",
    preferredName: null,
    email: "alex@example.com",
    phone: "+919999999999",
    alternatePhone: null,
    dateOfBirth: null,
    location: "Bengaluru",
    currentCompany: "Acme",
    currentTitle: "Backend Engineer",
    linkedinUrl: null,
    professionalSummary: null,
    headline: null,
    totalExperienceYears: "5",
    githubUrl: null,
    preferredWorkMode: null,
    willingToRelocate: null,
    source: "manual" as never,
    status: "active" as never,
    doNotHireReason: null,
    currentCtc: null,
    expectedCtc: null,
    currency: "INR",
    noticePeriodDays: null,
    earliestJoinDate: null,
    availabilityNotes: null,
    timezone: null,
    primaryRecruiterUserId: null,
    referredByEmployeeId: null,
    employeeId: null,
    mergedIntoCandidateId: null,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    normalizedEmail: "alex@example.com",
    normalizedPhone: "919999999999",
    personal: null,
    documents: [],
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    certifications: [],
    notes: [],
    ...overrides,
  };
}

function enrichmentContent(
  overrides: Record<string, unknown> = {},
  candidate: CandidateDetail = baseCandidate(),
  mapped: ResumeImportMappedDraft | null = null
) {
  const documentId =
    (overrides.documentId as string | null | undefined) ?? "doc-1";
  const sourceDraftId =
    (overrides.sourceDraftId as string | null | undefined) ?? "draft-1";
  const inputFingerprint =
    (overrides.inputFingerprint as string | undefined) ??
    computeEnrichmentInputFingerprint({
      candidate,
      mapped,
      documentId,
      sourceDraftId,
    });
  const restOverrides = { ...overrides };
  delete restOverrides.inputFingerprint;
  delete restOverrides.documentId;
  delete restOverrides.sourceDraftId;
  return {
    version: 1,
    kind: CANDIDATE_ENRICHMENT_CONTENT_KIND,
    promptVersion: CANDIDATE_ENRICHMENT_PROMPT_VERSION,
    documentId,
    sourceDraftId,
    inputFingerprint,
    fieldStatus: computeCandidateFieldStatus(candidate),
    enrichment: {
      summary: "AI suggested summary for backend engineer.",
      headline: "Backend Engineer · Node.js",
      strengths: ["APIs"],
      missingInformation: ["Notice period"],
      interviewTopics: ["REST"],
    },
    applied: { summary: false, headline: false },
    ...restOverrides,
  };
}

function pendingInsight(
  overrides: Record<string, unknown> = {},
  candidate: CandidateDetail = baseCandidate(),
  mapped: ResumeImportMappedDraft | null = null
) {
  const contentOverrides =
    (overrides.contentJson as Record<string, unknown> | undefined) ?? {};
  return {
    id: "insight-1",
    candidateId: "cand-1",
    insightType: AiInsightType.candidate_summary,
    status: AiInsightStatus.pending_review,
    reviewedByUserId: null,
    reviewedAt: null,
    ...overrides,
    contentJson: enrichmentContent(contentOverrides, candidate, mapped),
  };
}

describe("CandidateAiEnrichmentService accept/dismiss/RBAC", () => {
  let getCandidate: ReturnType<typeof vi.fn>;
  let getInsight: ReturnType<typeof vi.fn>;
  let listInsights: ReturnType<typeof vi.fn>;
  let createInsight: ReturnType<typeof vi.fn>;
  let updateInsightStatus: ReturnType<typeof vi.fn>;
  let updateCandidate: ReturnType<typeof vi.fn>;
  let service: CandidateAiEnrichmentService;

  beforeEach(async () => {
    vi.clearAllMocks();
    authMocks.requireHROrSuperAdminSession.mockResolvedValue(hrSession);
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      unrestrictedRecruitmentScope()
    );
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(
      () => undefined
    );

    getCandidate = vi.fn(async () => baseCandidate());
    getInsight = vi.fn(async () => pendingInsight());
    listInsights = vi.fn(async () => []);
    createInsight = vi.fn(async () => ({ id: "insight-new" }));
    updateInsightStatus = vi.fn(async () => undefined);
    updateCandidate = vi.fn(async () => undefined);

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    service = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      {
        id: "mock",
        generateCandidateEnrichment: vi.fn(async () => ({
          ok: true as const,
          data: {
            summary: "Generated summary",
            headline: "Generated headline",
            strengths: ["A"],
            missingInformation: ["Notice period"],
            interviewTopics: ["APIs"],
          },
          modelId: "mock-model",
          rawText: "{}",
        })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
      }
    );
  });

  it("accepts summary+headline for authorized HR without touching sensitive fields", async () => {
    const candidate = baseCandidate({
      currentCtc: "10" as never,
      expectedCtc: "20" as never,
      noticePeriodDays: 60,
      status: "active" as never,
      availabilityNotes: "two weeks",
    });
    getCandidate.mockResolvedValue(candidate);

    const result = await service.acceptEnrichmentFields(hrSession, {
      insightId: "insight-1",
      candidateId: "cand-1",
      acceptSummary: true,
      acceptHeadline: true,
    });

    expect(result.applied).toEqual(["professionalSummary", "headline"]);
    expect(updateCandidate).toHaveBeenCalledWith(
      "cand-1",
      {
        professionalSummary: "AI suggested summary for backend engineer.",
        headline: "Backend Engineer · Node.js",
      },
      expect.anything()
    );
    const patch = updateCandidate.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("currentCtc");
    expect(patch).not.toHaveProperty("expectedCtc");
    expect(patch).not.toHaveProperty("noticePeriodDays");
    expect(patch).not.toHaveProperty("availabilityNotes");
    expect(patch).not.toHaveProperty("status");
    expect(insightUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "insight-1" },
        data: expect.objectContaining({
          status: AiInsightStatus.accepted,
          reviewedByUserId: "user-hr",
          reviewedAt: expect.any(Date),
        }),
      })
    );
  });

  it("dismisses without modifying Candidate", async () => {
    await service.dismissEnrichment(hrSession, {
      insightId: "insight-1",
      candidateId: "cand-1",
    });

    expect(updateCandidate).not.toHaveBeenCalled();
    expect(updateInsightStatus).toHaveBeenCalledWith(
      "insight-1",
      AiInsightStatus.dismissed,
      expect.anything(),
      expect.objectContaining({
        reviewedByUserId: "user-hr",
        reviewedAt: expect.any(Date),
      })
    );
  });

  it("rejects generate/accept/dismiss for non-HR users", async () => {
    await expect(
      service.generateFromResumeDraft({
        candidateId: "cand-1",
        sourceDraftId: "draft-1",
        session: employeeSession,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      service.acceptEnrichmentFields(employeeSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptSummary: true,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    await expect(
      service.dismissEnrichment(employeeSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
      })
    ).rejects.toBeInstanceOf(PermissionError);

    expect(updateCandidate).not.toHaveBeenCalled();
    expect(updateInsightStatus).not.toHaveBeenCalled();
  });

  it("rejects accept/dismiss when candidate is outside scope", async () => {
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(
      () => {
        throw new RecruitmentDomainError(
          "REC_FORBIDDEN_SCOPE",
          "Candidate outside recruitment scope."
        );
      }
    );

    await expect(
      service.acceptEnrichmentFields(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptSummary: true,
      })
    ).rejects.toMatchObject({ code: "REC_FORBIDDEN_SCOPE" });

    await expect(
      service.dismissEnrichment(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
      })
    ).rejects.toMatchObject({ code: "REC_FORBIDDEN_SCOPE" });

    expect(updateCandidate).not.toHaveBeenCalled();
    expect(updateInsightStatus).not.toHaveBeenCalled();
    expect(insightUpdate).not.toHaveBeenCalled();
  });

  it("rejects candidateId / insightId mismatch without mutating", async () => {
    getInsight.mockResolvedValue(
      pendingInsight({ candidateId: "cand-other", id: "insight-1" })
    );

    await expect(
      service.acceptEnrichmentFields(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptSummary: true,
      })
    ).rejects.toMatchObject({
      code: "REC_VALIDATION",
      message: expect.stringMatching(/does not belong/i),
    });

    await expect(
      service.dismissEnrichment(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
      })
    ).rejects.toMatchObject({ code: "REC_VALIDATION" });

    expect(updateCandidate).not.toHaveBeenCalled();
    expect(updateInsightStatus).not.toHaveBeenCalled();
    expect(insightUpdate).not.toHaveBeenCalled();
  });

  it("rejects overwrite of existing summary/headline unless replace flags set", async () => {
    const filled = baseCandidate({
      professionalSummary: "Existing summary",
      headline: "Existing headline",
    });
    getCandidate.mockResolvedValue(filled);
    getInsight.mockImplementation(async (id: string) => {
      if (id === "draft-1") {
        return {
          id: "draft-1",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_parse,
          status: AiInsightStatus.accepted,
          contentJson: {
            version: 1,
            source: "parser",
            documentId: "doc-1",
            raw: {},
            mapped: {
              personal: {},
              professional: {},
              experiences: [],
              educations: [],
              skills: [],
              projects: [],
              certifications: [],
            },
            fieldConfidence: {},
            metadata: {},
          },
        };
      }
      return pendingInsight({}, filled, null);
    });

    await expect(
      service.acceptEnrichmentFields(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptSummary: true,
      })
    ).rejects.toMatchObject({
      code: "REC_VALIDATION",
      message: expect.stringMatching(/replaceSummary/i),
    });

    await expect(
      service.acceptEnrichmentFields(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptHeadline: true,
      })
    ).rejects.toMatchObject({
      code: "REC_VALIDATION",
      message: expect.stringMatching(/replaceHeadline/i),
    });

    expect(updateCandidate).not.toHaveBeenCalled();

    const replaced = await service.acceptEnrichmentFields(hrSession, {
      insightId: "insight-1",
      candidateId: "cand-1",
      acceptSummary: true,
      acceptHeadline: true,
      replaceSummary: true,
      replaceHeadline: true,
    });
    expect(replaced.applied).toEqual(["professionalSummary", "headline"]);
    expect(updateCandidate).toHaveBeenCalled();
  });

  it("rejects stale accept when profile changed after enrichment", async () => {
    const original = baseCandidate();
    getInsight.mockResolvedValue(pendingInsight({}, original, null));
    getCandidate.mockResolvedValue(
      baseCandidate({
        experiences: [
          {
            id: "e2",
            candidateId: "cand-1",
            company: "NewCo",
            title: "Staff Engineer",
            location: null,
            startDate: null,
            endDate: null,
            isCurrent: true,
            description: "Changed",
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            companyName: "NewCo",
            designation: "Staff Engineer",
            employmentType: null,
            currentlyWorking: true,
          },
        ],
      })
    );

    await expect(
      service.acceptEnrichmentFields(hrSession, {
        insightId: "insight-1",
        candidateId: "cand-1",
        acceptSummary: true,
      })
    ).rejects.toMatchObject({
      code: "REC_VALIDATION",
      message: ENRICHMENT_STALE_ACCEPT_MESSAGE,
    });
    expect(updateCandidate).not.toHaveBeenCalled();
  });

  it("allows accept when summary/headline are empty", async () => {
    getCandidate.mockResolvedValue(
      baseCandidate({ professionalSummary: null, headline: "   " })
    );

    const result = await service.acceptEnrichmentFields(hrSession, {
      insightId: "insight-1",
      candidateId: "cand-1",
      acceptSummary: true,
      acceptHeadline: true,
    });

    expect(result.applied).toEqual(["professionalSummary", "headline"]);
    expect(updateCandidate).toHaveBeenCalled();
  });

  it("reuses existing pending insight when force=false (no duplicate create)", async () => {
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const candidate = baseCandidate();
    getCandidate.mockResolvedValue(candidate);
    getInsight.mockResolvedValue({
      id: "draft-1",
      candidateId: "cand-1",
      insightType: AiInsightType.resume_parse,
      status: AiInsightStatus.pending_review,
      contentJson: draft,
    });
    listInsights.mockResolvedValue([
      pendingInsight(
        {
          id: "existing-pending",
          contentJson: enrichmentContent(
            {
              documentId: "doc-1",
              sourceDraftId: "draft-1",
            },
            candidate,
            draft.mapped
          ),
        },
        candidate,
        draft.mapped
      ),
    ]);

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: true as const,
        data: {
          summary: "Should not persist",
          headline: "Nope",
          strengths: ["x"],
          missingInformation: [],
          interviewTopics: ["y"],
        },
        modelId: "m",
        rawText: "{}",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const svc = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      provider
    );

    const result = await svc.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: false,
    });

    expect(result).toEqual({ insightId: "existing-pending", reused: true });
    expect(provider.generateCandidateEnrichment).not.toHaveBeenCalled();
    expect(createInsight).not.toHaveBeenCalled();
  });

  it("does not reuse pending insight from a different resume/draft", async () => {
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const draftB = buildStubResumeImportContent({ documentId: "doc-B" });
    const candidate = baseCandidate();
    getCandidate.mockResolvedValue(candidate);
    getInsight.mockResolvedValue({
      id: "draft-B",
      candidateId: "cand-1",
      insightType: AiInsightType.resume_parse,
      status: AiInsightStatus.accepted,
      contentJson: draftB,
    });
    listInsights.mockResolvedValue([
      pendingInsight(
        {
          id: "pending-A",
          contentJson: enrichmentContent({
            documentId: "doc-A",
            sourceDraftId: "draft-A",
          }),
        },
        candidate,
        null
      ),
    ]);

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: true as const,
        data: {
          summary: "Fresh for resume B",
          headline: "B headline",
          strengths: ["B"],
          missingInformation: ["Notice period"],
          interviewTopics: ["APIs"],
        },
        modelId: "m",
        rawText: "{}",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const svc = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      provider
    );

    const result = await svc.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-B",
      session: hrSession,
      force: false,
    });

    expect(result.reused).toBeFalsy();
    expect(result.insightId).toBe("insight-new");
    expect(provider.generateCandidateEnrichment).toHaveBeenCalled();
    expect(updateInsightStatus).toHaveBeenCalledWith(
      "pending-A",
      AiInsightStatus.superseded,
      expect.anything(),
      expect.anything()
    );
    expect(createInsight).toHaveBeenCalled();
    const created = createInsight.mock.calls[0][1] as {
      contentJson: { documentId: string | null; sourceDraftId: string | null };
    };
    expect(created.contentJson.documentId).toBe("doc-B");
    expect(created.contentJson.sourceDraftId).toBe("draft-B");
  });

  it("regenerates when same draft fingerprint changes after profile edit", async () => {
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const original = baseCandidate();
    // Profile experience takes precedence over mapped draft in enrichment context.
    const edited = baseCandidate({
      headline: "Staff Engineer · Platform",
      experiences: [
        {
          id: "e2",
          candidateId: "cand-1",
          company: "NewCo",
          title: "Staff Engineer",
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: true,
          description: "Owned platform APIs",
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          companyName: "NewCo",
          designation: "Staff Engineer",
          employmentType: null,
          currentlyWorking: true,
        },
      ],
    });
    getCandidate.mockResolvedValue(edited);
    getInsight.mockResolvedValue({
      id: "draft-1",
      candidateId: "cand-1",
      insightType: AiInsightType.resume_parse,
      status: AiInsightStatus.accepted,
      contentJson: draft,
    });
    listInsights.mockResolvedValue([
      pendingInsight(
        {
          id: "stale-pending",
          contentJson: enrichmentContent(
            {
              documentId: "doc-1",
              sourceDraftId: "draft-1",
            },
            original,
            draft.mapped
          ),
        },
        original,
        draft.mapped
      ),
    ]);

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: true as const,
        data: {
          summary: "Fresh after profile edit",
          headline: "TS Engineer",
          strengths: ["TypeScript"],
          missingInformation: [],
          interviewTopics: ["Types"],
        },
        modelId: "m",
        rawText: "{}",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const svc = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      provider
    );

    const result = await svc.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: false,
    });

    expect(result.reused).toBeFalsy();
    expect(provider.generateCandidateEnrichment).toHaveBeenCalled();
    expect(updateInsightStatus).toHaveBeenCalledWith(
      "stale-pending",
      AiInsightStatus.superseded,
      expect.anything(),
      expect.anything()
    );
    const created = createInsight.mock.calls[0][1] as {
      contentJson: { inputFingerprint: string };
    };
    expect(created.contentJson.inputFingerprint).toBe(
      computeEnrichmentInputFingerprint({
        candidate: edited,
        mapped: draft.mapped,
        documentId: "doc-1",
        sourceDraftId: "draft-1",
      })
    );
  });

  it("never reuses accepted or dismissed insights for pending enrichment", async () => {
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const candidate = baseCandidate();
    getCandidate.mockResolvedValue(candidate);
    getInsight.mockResolvedValue({
      id: "draft-1",
      candidateId: "cand-1",
      insightType: AiInsightType.resume_parse,
      status: AiInsightStatus.accepted,
      contentJson: draft,
    });
    listInsights.mockResolvedValue([
      pendingInsight(
        {
          id: "accepted-old",
          status: AiInsightStatus.accepted,
          contentJson: enrichmentContent(
            {
              documentId: "doc-1",
              sourceDraftId: "draft-1",
            },
            candidate,
            draft.mapped
          ),
        },
        candidate,
        draft.mapped
      ),
      pendingInsight(
        {
          id: "dismissed-old",
          status: AiInsightStatus.dismissed,
          contentJson: enrichmentContent(
            {
              documentId: "doc-1",
              sourceDraftId: "draft-1",
            },
            candidate,
            draft.mapped
          ),
        },
        candidate,
        draft.mapped
      ),
    ]);

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: true as const,
        data: {
          summary: "New pending",
          headline: "Fresh",
          strengths: ["x"],
          missingInformation: [],
          interviewTopics: ["y"],
        },
        modelId: "m",
        rawText: "{}",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const svc = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      provider
    );

    const result = await svc.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: false,
    });

    expect(result.reused).toBeFalsy();
    expect(result.insightId).toBe("insight-new");
    expect(provider.generateCandidateEnrichment).toHaveBeenCalled();
  });

  it("keeps at most one pending insight for concurrent latest-context schedules", async () => {
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const { Prisma } = await import("@/generated/prisma/client");
    const draftB = buildStubResumeImportContent({ documentId: "doc-B" });
    const candidate = baseCandidate();
    getCandidate.mockResolvedValue(candidate);
    getInsight.mockResolvedValue({
      id: "draft-B",
      candidateId: "cand-1",
      insightType: AiInsightType.resume_parse,
      status: AiInsightStatus.accepted,
      contentJson: draftB,
    });

    let pendingRows: Array<Record<string, unknown>> = [
      pendingInsight(
        {
          id: "pending-A",
          contentJson: enrichmentContent({
            documentId: "doc-A",
            sourceDraftId: "draft-A",
          }),
        },
        candidate,
        null
      ),
    ];
    listInsights.mockImplementation(async () => [...pendingRows]);
    updateInsightStatus.mockImplementation(async (id: string, status: string) => {
      pendingRows = pendingRows.map((row) =>
        String(row.id) === id ? { ...row, status } : row
      );
    });

    let createCalls = 0;
    createInsight.mockImplementation(async (_cid: string, data: { contentJson: unknown }) => {
      createCalls += 1;
      if (createCalls === 1) {
        throw new Prisma.PrismaClientKnownRequestError("Unique pending", {
          code: "P2002",
          clientVersion: "test",
        });
      }
      const id = "pending-B";
      pendingRows = [
        ...pendingRows.filter(
          (row) => row.status === AiInsightStatus.pending_review
        ),
        {
          id,
          candidateId: "cand-1",
          insightType: AiInsightType.candidate_summary,
          status: AiInsightStatus.pending_review,
          contentJson: data.contentJson,
        },
      ];
      return { id };
    });

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: true as const,
        data: {
          summary: "Latest context wins",
          headline: "B",
          strengths: ["B"],
          missingInformation: [],
          interviewTopics: ["B"],
        },
        modelId: "m",
        rawText: "{}",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const svc = createCandidateAiEnrichmentService(
      {
        getCandidate,
        getInsight,
        listInsights,
        createInsight,
        updateInsightStatus,
        updateCandidate,
      } as never,
      provider
    );

    const result = await svc.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-B",
      session: hrSession,
      force: false,
    });

    const stillPending = pendingRows.filter(
      (row) => row.status === AiInsightStatus.pending_review
    );
    expect(stillPending.length).toBeLessThanOrEqual(1);
    expect(result.insightId).toBe("pending-B");
    const content = stillPending[0]?.contentJson as {
      documentId?: string;
      sourceDraftId?: string;
    };
    expect(content.documentId).toBe("doc-B");
    expect(content.sourceDraftId).toBe("draft-B");
  });

  it("dismisses stale pending insight without mutating Candidate", async () => {
    const original = baseCandidate();
    getInsight.mockResolvedValue(pendingInsight({}, original, null));
    getCandidate.mockResolvedValue(
      baseCandidate({ headline: "Changed after AI" })
    );

    await service.dismissEnrichment(hrSession, {
      insightId: "insight-1",
      candidateId: "cand-1",
    });

    expect(updateCandidate).not.toHaveBeenCalled();
    expect(updateInsightStatus).toHaveBeenCalledWith(
      "insight-1",
      AiInsightStatus.dismissed,
      expect.anything(),
      expect.objectContaining({ reviewedByUserId: "user-hr" })
    );
  });
});

describe("AI enrichment actions auth gate", () => {
  it("rejects generate/accept/dismiss when session is not HR/SA", async () => {
    authMocks.requireHROrSuperAdminSession.mockRejectedValue(
      new PermissionError("Forbidden")
    );

    const {
      generateCandidateAiEnrichmentAction,
      acceptCandidateAiEnrichmentAction,
      dismissCandidateAiEnrichmentAction,
    } = await import("@/actions/recruitment-ai-enrichment");

    const generate = await generateCandidateAiEnrichmentAction(
      {},
      { candidateId: "cand-1", sourceDraftId: "draft-1" }
    );
    const accept = await acceptCandidateAiEnrichmentAction(
      {},
      {
        candidateId: "cand-1",
        insightId: "insight-1",
        acceptSummary: true,
      }
    );
    const dismiss = await dismissCandidateAiEnrichmentAction(
      {},
      { candidateId: "cand-1", insightId: "insight-1" }
    );

    expect(generate.error).toMatch(/Forbidden/i);
    expect(accept.error).toMatch(/Forbidden/i);
    expect(dismiss.error).toMatch(/Forbidden/i);
  });
});
