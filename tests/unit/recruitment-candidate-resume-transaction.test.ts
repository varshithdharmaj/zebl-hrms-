import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";

/**
 * Phase 3 — DB persistence & rollback guarantees for single-pass resume parsing.
 *
 * candidateService.createCandidate() creates the Candidate row (+ Experience/
 * Education/Skill/etc.) AND, when `initialAiInsight` is supplied, the
 * resume_parse CandidateAiInsight — inside the SAME withRecruitmentTransaction
 * callback (see candidate-service.ts). These tests prove the atomicity
 * contract at the service boundary: one tx instance reaches both repository
 * calls, and a failure in either one aborts the whole write.
 */

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
  publishAfterCommit: vi.fn(),
}));

/**
 * Faithful enough to prove atomicity from the caller's side: this mock does
 * NOT swallow a thrown error — exactly like Prisma's real
 * `$transaction(async (tx) => {...})`, which rolls back automatically the
 * instant the callback throws. Everything after the `await
 * withRecruitmentTransaction(...)` call (event flush, timeline append) simply
 * never runs when the callback rejects — that's what "rollback" looks like
 * from this layer without spinning up a real Postgres instance.
 */
vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) =>
    work({ __fakeTx: true }),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
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

function makeMockRepo(overrides: Partial<CandidateRepository> = {}): CandidateRepository {
  return {
    createCandidate: vi.fn(async () => ({ id: "cand-1" })),
    updateCandidate: vi.fn(),
    softDeleteCandidate: vi.fn(),
    setStatus: vi.fn(),
    getCandidate: vi.fn(async () => null),
    getCandidateOverview: vi.fn(),
    findByEmail: vi.fn(),
    findByPhone: vi.fn(),
    listCandidates: vi.fn(),
    searchCandidates: vi.fn(),
    countCandidates: vi.fn(),
    setEmployeeLink: vi.fn(),
    markMerged: vi.fn(),
    upsertExperience: vi.fn(),
    upsertEducation: vi.fn(),
    upsertSkill: vi.fn(),
    upsertProject: vi.fn(),
    upsertCertification: vi.fn(),
    replaceSection: vi.fn(),
    addDocument: vi.fn(),
    setPrimaryResume: vi.fn(),
    softDeleteDocument: vi.fn(),
    getCandidateDocument: vi.fn(),
    updateCandidateDocument: vi.fn(),
    restoreCandidateDocument: vi.fn(),
    listCandidateDocuments: vi.fn(async () => []),
    findDocumentByChecksum: vi.fn(async () => null),
    setTags: vi.fn(),
    addTalentPoolEntry: vi.fn(),
    closeTalentPoolEntry: vi.fn(),
    createInsight: vi.fn(async () => ({ id: "insight-1" })),
    updateInsightContent: vi.fn(async () => undefined),
    getInsight: vi.fn(),
    listInsights: vi.fn(async () => []),
    findReviewableInsights: vi.fn(async () => []),
    findResumeParseDrafts: vi.fn(async () => []),
    updateInsightStatus: vi.fn(async () => undefined),
    createIntake: vi.fn(),
    updateIntake: vi.fn(),
    findIntake: vi.fn(),
    listIntake: vi.fn(),
    archiveCandidate: vi.fn(),
    restoreCandidate: vi.fn(),
    findByNormalizedEmail: vi.fn(async () => null),
    findByNormalizedPhone: vi.fn(async () => null),
    findDuplicateCandidates: vi.fn(async () => []),
    addNote: vi.fn(),
    updateNote: vi.fn(),
    softDeleteNote: vi.fn(),
    listNotes: vi.fn(),
    ...overrides,
  } as unknown as CandidateRepository;
}

const SAMPLE_INSIGHT_CONTENT = {
  version: 1,
  source: "parser",
  documentId: null,
  raw: {},
  mapped: {
    personal: { fullName: "Priya Nair", email: "priya@example.com" },
    professional: {},
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    certifications: [],
  },
  fieldConfidence: {},
  aiInsights: {
    executiveSummary: "Backend engineer with strong Node.js background.",
    strengths: ["Node.js", "PostgreSQL"],
    gaps: [],
    matchScore: { value: null, rationale: null },
    clarificationFlags: [],
  },
  extractionMeta: {
    documentQuality: "clean" as const,
    fieldsRequiringReview: [],
    languageDetected: "en",
  },
  metadata: { parserVersion: "llm-v3-single-pass" },
};

describe("candidateService.createCandidate — single-pass transactional integrity", () => {
  let mockRepo: CandidateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = makeMockRepo();
  });

  it("creates Candidate + resume_parse AiInsight in one transaction, same tx instance", async () => {
    const service = createCandidateService(mockRepo);

    const result = await service.createCandidate(hrSession, {
      fullName: "Priya Nair",
      email: "priya@example.com",
      initialAiInsight: {
        contentJson: SAMPLE_INSIGHT_CONTENT,
        modelId: "gemini-2.5-flash",
      },
    });

    expect(result.id).toBe("cand-1");
    expect(result.insightId).toBe("insight-1");

    expect(mockRepo.createCandidate).toHaveBeenCalledTimes(1);
    expect(mockRepo.createInsight).toHaveBeenCalledTimes(1);
    expect(mockRepo.createInsight).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        insightType: AiInsightType.resume_parse,
        status: AiInsightStatus.accepted,
        contentJson: SAMPLE_INSIGHT_CONTENT,
        modelId: "gemini-2.5-flash",
      }),
      expect.anything()
    );

    // Same tx object reached both writes — proves one transaction, not two.
    const createCandidateMock = mockRepo.createCandidate as unknown as {
      mock: { calls: unknown[][] };
    };
    const createInsightMock = mockRepo.createInsight as unknown as {
      mock: { calls: unknown[][] };
    };
    const candidateTx = createCandidateMock.mock.calls[0]?.[1];
    const insightTx = createInsightMock.mock.calls[0]?.[2];
    expect(candidateTx).toBeDefined();
    expect(insightTx).toBe(candidateTx);
  });

  it("rolls back: AiInsight write failure aborts the whole candidate creation", async () => {
    mockRepo.createInsight = vi.fn(async () => {
      throw new Error("simulated unique constraint violation on candidate_ai_insights");
    });
    const service = createCandidateService(mockRepo);

    await expect(
      service.createCandidate(hrSession, {
        fullName: "Priya Nair",
        email: "priya@example.com",
        initialAiInsight: { contentJson: SAMPLE_INSIGHT_CONTENT },
      })
    ).rejects.toThrow(/simulated unique constraint violation/);

    // Nothing "post-commit" ran: no timeline entry for a candidate that,
    // in a real transaction, was never actually persisted.
    const { RecruitmentTimelineService } = await import(
      "@/lib/recruitment/services/timeline-service"
    );
    expect(RecruitmentTimelineService.append).not.toHaveBeenCalled();
  });

  it("rolls back: candidate row failure means the AiInsight is never attempted", async () => {
    mockRepo.createCandidate = vi.fn(async () => {
      throw new Error("simulated FK violation");
    });
    const service = createCandidateService(mockRepo);

    await expect(
      service.createCandidate(hrSession, {
        fullName: "Priya Nair",
        initialAiInsight: { contentJson: SAMPLE_INSIGHT_CONTENT },
      })
    ).rejects.toThrow(/simulated FK violation/);

    expect(mockRepo.createInsight).not.toHaveBeenCalled();
  });

  it("partial/malformed aiInsights payload still commits — content is opaque JSON to this layer", async () => {
    // Schema validation (Zod, in llm-parse-schema.ts) happens upstream, before
    // this service ever sees contentJson. This layer's contract is narrower:
    // whatever JSON-serializable object it's given, it persists as-is or not
    // at all — it does not partially write a half-valid insight.
    const service = createCandidateService(mockRepo);
    const degraded = {
      ...SAMPLE_INSIGHT_CONTENT,
      aiInsights: {
        executiveSummary: null,
        strengths: [],
        gaps: [],
        matchScore: { value: null, rationale: null },
        clarificationFlags: [],
      },
      extractionMeta: {
        documentQuality: "image_only" as const,
        fieldsRequiringReview: [],
        languageDetected: null,
      },
    };

    const result = await service.createCandidate(hrSession, {
      fullName: "Manual Fallback Candidate",
      initialAiInsight: { contentJson: degraded },
    });

    expect(result.insightId).toBe("insight-1");
    expect(mockRepo.createInsight).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({ contentJson: degraded }),
      expect.anything()
    );
  });

  it("manual candidate creation (no initialAiInsight) never touches createInsight", async () => {
    const service = createCandidateService(mockRepo);
    const result = await service.createCandidate(hrSession, { fullName: "Manual Entry" });

    expect(result.insightId).toBeUndefined();
    expect(mockRepo.createInsight).not.toHaveBeenCalled();
  });
});
