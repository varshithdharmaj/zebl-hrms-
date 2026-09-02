import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiInsightStatus,
  AiInsightType,
  CandidateSource,
  CandidateStatus,
  IntakeItemStatus,
} from "@/generated/prisma/enums";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import {
  cleanupConsumedIntakeStorage,
  createCandidateFromResumeService,
  RESUME_ATTACH_FAILURE_MESSAGE,
} from "@/lib/recruitment/services/create-candidate-from-resume-service";
import {
  mapParsedDraftToReviewDefaults,
  stripDeniedFieldsFromReviewPayload,
} from "@/lib/recruitment/resume-import/map-new-candidate-review";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";
import { createCandidateFromResumeReviewSchema } from "@/lib/validation/schemas/recruitment/new-candidate-resume";
import { validateResumeFile } from "@/lib/recruitment/resume-import/file-validation";
import { RESUME_PARSER_VERSION } from "@/lib/recruitment/resume-import/parser/types";

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

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) =>
    work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/recruitment/repositories/prisma-timeline-repository", () => ({
  prismaTimelineProjectionRepository: {
    append: vi.fn(async () => ({ id: "tl-1" })),
  },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const storageSave = vi.fn(async () => undefined);
const storageRead = vi.fn(async () => Buffer.from("%PDF-1.4 fake"));
const storageExists = vi.fn(async () => true);
const storageDelete = vi.fn(async () => undefined);

vi.mock("@/lib/recruitment/storage/recruitment-storage", () => ({
  getRecruitmentStorage: () => ({
    save: storageSave,
    read: storageRead,
    exists: storageExists,
    delete: storageDelete,
  }),
}));

const parseResumeWithLlm = vi.fn();

vi.mock("@/lib/recruitment/resume-import/parser/llm-parse-resume", () => ({
  parseResumeWithLlm: (...args: unknown[]) => parseResumeWithLlm(...args),
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

function sampleMapped(): ResumeImportMappedDraft {
  return {
    personal: {
      fullName: "Rahul Kumar",
      firstName: "Rahul",
      lastName: "Kumar",
      email: "rahul@example.com",
      phone: "+919876543210",
      location: "Bengaluru",
    },
    professional: {
      headline: "Software Engineer",
      professionalSummary: "Builds APIs",
      currentCompany: "ABC Technologies",
      currentTitle: "Software Engineer",
      githubUrl: "https://github.com/rahul",
      linkedinUrl: "https://linkedin.com/in/rahul",
      portfolioUrl: "https://rahul.dev",
      totalExperienceYears: "5",
      preferredWorkMode: null,
      willingToRelocate: null,
    },
    experiences: [
      {
        company: "ABC Technologies",
        title: "Software Engineer",
        startDate: "2020-01",
        endDate: null,
        isCurrent: true,
        description: "Backend",
      },
    ],
    educations: [
      {
        institution: "NIT",
        degree: "B.Tech",
        field: "CSE",
        startYear: 2014,
        endYear: 2018,
        grade: "8.1",
      },
    ],
    skills: [{ name: "TypeScript" }, { name: "Node.js" }],
    projects: [
      {
        title: "AMS",
        summary: "HR tool",
        techStack: "Next.js",
        url: "https://example.com",
        duration: "6 months",
      },
    ],
    certifications: [
      {
        name: "AWS SAA",
        issuer: "Amazon",
        issuedAt: "2023-01",
        credentialUrl: "https://aws.amazon.com/cert",
        credentialId: "ABC123",
      },
    ],
  };
}

function emptyDraftContent(mapped: ResumeImportMappedDraft = sampleMapped()) {
  return {
    version: 1 as const,
    source: "parser" as const,
    documentId: null,
    raw: {},
    mapped,
    fieldConfidence: {},
    metadata: { parserVersion: RESUME_PARSER_VERSION },
  };
}

function baseIntake(overrides: Record<string, unknown> = {}) {
  return {
    id: "intake-1",
    createdByUserId: "user-hr",
    candidateId: null,
    storageKey: "recruitment/intake/intake-1/documents/x-resume.pdf",
    rawPayloadJson: {
      kind: "new_candidate_resume_v1",
      draftContent: emptyDraftContent(),
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12,
      checksum: "abc",
    },
    status: IntakeItemStatus.parse_ready,
    ...overrides,
  };
}

describe("new-candidate resume file validation", () => {
  it("accepts PDF", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "resume.pdf", {
      type: "application/pdf",
    });
    expect(validateResumeFile(file).ok).toBe(true);
  });

  it("accepts DOCX", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(validateResumeFile(file).ok).toBe(true);
  });

  it("rejects unsupported type", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "resume.png", {
      type: "image/png",
    });
    expect(validateResumeFile(file).ok).toBe(false);
  });
});

describe("mapParsedDraftToReviewDefaults", () => {
  it("maps parser output into candidate creation draft", () => {
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    expect(review.intakeId).toBe("intake-1");
    expect(review.candidate.fullName).toBe("Rahul Kumar");
    expect(review.experiences).toHaveLength(1);
    expect(review.skills.map((s) => s.name)).toEqual(["TypeScript", "Node.js"]);
  });

  it("strips denied fields before create", () => {
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    const polluted = {
      ...review,
      candidate: {
        ...review.candidate,
        currentCtc: "1000000",
        expectedCtc: "1200000",
        currency: "INR",
        noticePeriodDays: 30,
        preferredLocation: "Remote",
        status: CandidateStatus.active,
        source: CandidateSource.manual_upload,
      } as typeof review.candidate,
    };
    const cleaned = stripDeniedFieldsFromReviewPayload(polluted);
    expect("currentCtc" in cleaned.candidate).toBe(false);
    expect(createCandidateFromResumeReviewSchema.safeParse(cleaned).success).toBe(
      true
    );
  });
});

describe("createCandidateFromResumeService attach safety", () => {
  let mockRepo: CandidateRepository;
  let createdCandidatePayload: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    createdCandidatePayload = null;
    storageExists.mockResolvedValue(true);
    storageRead.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
    storageSave.mockResolvedValue(undefined);
    storageDelete.mockResolvedValue(undefined);

    mockRepo = {
      createCandidate: vi.fn(async (data) => {
        createdCandidatePayload = data as Record<string, unknown>;
        return { id: "cand-new" };
      }),
      updateCandidate: vi.fn(),
      softDeleteCandidate: vi.fn(),
      setStatus: vi.fn(),
      getCandidate: vi.fn(),
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
      addDocument: vi.fn(async () => ({ id: "doc-1" })),
      setPrimaryResume: vi.fn(),
      softDeleteDocument: vi.fn(),
      setTags: vi.fn(),
      addTalentPoolEntry: vi.fn(),
      closeTalentPoolEntry: vi.fn(),
      createInsight: vi.fn(async () => ({ id: "insight-resume" })),
      getInsight: vi.fn(),
      listInsights: vi.fn(async () => []),
      updateInsightStatus: vi.fn(async () => undefined),
      updateInsightContent: vi.fn(),
      createIntake: vi.fn(async () => ({ id: "intake-1" })),
      updateIntake: vi.fn(async () => undefined),
      findIntake: vi.fn(async () => baseIntake()),
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
      getCandidateDocument: vi.fn(),
      updateCandidateDocument: vi.fn(),
      restoreCandidateDocument: vi.fn(),
      listCandidateDocuments: vi.fn(async () => []),
      findDocumentByChecksum: vi.fn(async () => null),
    } as unknown as CandidateRepository;

    parseResumeWithLlm.mockResolvedValue({
      result: {
        ok: true,
        draft: {},
        warnings: [],
        rawTextLength: 100,
      },
      draftContent: emptyDraftContent(),
    });
  });

  it("Test 1: create + attach success consumes intake and returns sourceDraftId", async () => {
    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());

    const result = await service.createFromReview(hrSession, review);

    expect(result.candidateId).toBe("cand-new");
    expect(result.resumeAttached).toBe(true);
    expect(result.sourceDraftId).toBe("insight-resume");
    expect(result.resumeAttachmentError).toBeUndefined();
    expect(createdCandidatePayload?.experiences).toHaveLength(1);
    expect(mockRepo.addDocument).toHaveBeenCalled();
    expect(mockRepo.createInsight).toHaveBeenCalledWith(
      "cand-new",
      expect.objectContaining({
        insightType: AiInsightType.resume_parse,
        status: AiInsightStatus.accepted,
      }),
      expect.anything()
    );
    // Insight is created ONCE, inside the candidate-creation transaction —
    // the later document-attach step must patch it, never create a second row.
    expect(mockRepo.createInsight).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateInsightContent).toHaveBeenCalledWith(
      "insight-resume",
      expect.objectContaining({ documentId: "doc-1" }),
      expect.anything()
    );
    expect(mockRepo.updateIntake).toHaveBeenCalledWith(
      "intake-1",
      expect.objectContaining({ candidateId: "cand-new" })
    );
    expect(mockRepo.updateIntake).toHaveBeenCalledWith(
      "intake-1",
      expect.objectContaining({
        status: IntakeItemStatus.confirmed,
        candidateId: "cand-new",
      }),
      expect.anything()
    );
    expect(storageDelete).toHaveBeenCalledWith(
      "recruitment/intake/intake-1/documents/x-resume.pdf"
    );
    expect(mockRepo.updateIntake).toHaveBeenCalledWith("intake-1", {
      storageKey: null,
    });
  });

  it("Test 2: create succeeds + resume copy fails → structured failure, intake kept, no AI source", async () => {
    storageRead.mockRejectedValueOnce(new Error("disk fail"));
    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());

    const result = await service.createFromReview(hrSession, review);

    expect(result.candidateId).toBe("cand-new");
    expect(result.resumeAttached).toBe(false);
    expect(result.sourceDraftId).toBe("");
    expect(result.resumeAttachmentError).toBe(RESUME_ATTACH_FAILURE_MESSAGE);
    expect(mockRepo.addDocument).not.toHaveBeenCalled();
    expect(storageDelete).not.toHaveBeenCalled();
    expect(mockRepo.updateIntake).toHaveBeenCalledWith(
      "intake-1",
      expect.objectContaining({
        candidateId: "cand-new",
        errorMessage: RESUME_ATTACH_FAILURE_MESSAGE,
      })
    );
  });

  it("Test 3: permanent copy ok + metadata TX fails → no false success, permanent file kept", async () => {
    mockRepo.addDocument = vi.fn(async () => {
      throw new Error("db fail");
    });
    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());

    const result = await service.createFromReview(hrSession, review);

    expect(result.resumeAttached).toBe(false);
    expect(result.sourceDraftId).toBe("");
    expect(result.candidateId).toBe("cand-new");
    expect(storageSave).toHaveBeenCalled();
    // Permanent candidate doc key must NOT be deleted on metadata failure.
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("Test 4: successful cleanup is idempotent", async () => {
    const updateIntake = vi.fn(async () => undefined);
    const storage = {
      save: vi.fn(),
      read: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(async () => undefined),
      getMetadata: vi.fn(),
    };

    await cleanupConsumedIntakeStorage({
      repository: { updateIntake } as unknown as CandidateRepository,
      storage,
      intakeId: "intake-1",
      storageKey: "recruitment/intake/intake-1/documents/x-resume.pdf",
    });
    await cleanupConsumedIntakeStorage({
      repository: { updateIntake } as unknown as CandidateRepository,
      storage,
      intakeId: "intake-1",
      storageKey: null,
    });

    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(updateIntake).toHaveBeenCalledTimes(2);
    expect(updateIntake).toHaveBeenCalledWith("intake-1", { storageKey: null });
  });

  it("does not delete active/abandoned intake storage during failed attach", async () => {
    storageExists.mockResolvedValueOnce(false);
    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());

    const result = await service.createFromReview(hrSession, review);

    expect(result.resumeAttached).toBe(false);
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("retry after claimed intake skips second candidate create", async () => {
    mockRepo.findIntake = vi.fn(async () =>
      baseIntake({
        candidateId: "cand-new",
        status: IntakeItemStatus.parse_ready,
      })
    );

    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    const result = await service.createFromReview(hrSession, review);

    expect(mockRepo.createCandidate).not.toHaveBeenCalled();
    expect(result.candidateId).toBe("cand-new");
    expect(result.resumeAttached).toBe(true);
    expect(result.sourceDraftId).toBe("insight-resume");
  });

  it("retry path (candidate exists, no insight yet) falls back to create-if-missing in the doc-attach step", async () => {
    // Candidate already claimed by a previous partial attempt; this run never
    // calls candidateService.createCandidate, so there is no insightId yet.
    mockRepo.findIntake = vi.fn(async () =>
      baseIntake({ candidateId: "cand-new", status: IntakeItemStatus.parse_ready })
    );
    // No existing resume_parse insight for this candidate/document.
    mockRepo.listInsights = vi.fn(async () => []);

    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    const result = await service.createFromReview(hrSession, review);

    expect(mockRepo.createCandidate).not.toHaveBeenCalled();
    expect(mockRepo.createInsight).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateInsightContent).not.toHaveBeenCalled();
    expect(result.resumeAttached).toBe(true);
    expect(result.sourceDraftId).toBe("insight-resume");
  });

  it("confirmed intake cleanup is idempotent and does not recreate candidate", async () => {
    mockRepo.findIntake = vi.fn(async () =>
      baseIntake({
        candidateId: "cand-new",
        status: IntakeItemStatus.confirmed,
        storageKey: "recruitment/intake/intake-1/documents/x-resume.pdf",
      })
    );
    mockRepo.findDocumentByChecksum = vi.fn(async () => ({
      id: "doc-1",
      storageKey: "candidates/cand-new/documents/y-resume.pdf",
    }));
    mockRepo.listInsights = vi.fn(async () => [
      {
        id: "insight-resume",
        status: AiInsightStatus.accepted,
        contentJson: {
          version: 1,
          source: "parser",
          documentId: "doc-1",
          raw: {},
          mapped: sampleMapped(),
          fieldConfidence: {},
          metadata: {},
        },
      },
    ]);
    storageExists.mockResolvedValue(true);

    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    const result = await service.createFromReview(hrSession, review);

    expect(mockRepo.createCandidate).not.toHaveBeenCalled();
    expect(mockRepo.addDocument).not.toHaveBeenCalled();
    expect(result.resumeAttached).toBe(true);
    expect(result.sourceDraftId).toBe("insight-resume");
    expect(storageDelete).toHaveBeenCalled();
  });

  it("preserves duplicate email protection", async () => {
    mockRepo.findByNormalizedEmail = vi.fn(async () => ({
      id: "dup-1",
    })) as never;

    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());

    await expect(service.createFromReview(hrSession, review)).rejects.toMatchObject({
      code: "REC_CONFLICT",
      message: expect.stringContaining("email"),
    });
  });

  it("handles empty document parse failure without creating candidate", async () => {
    parseResumeWithLlm.mockResolvedValue({
      result: {
        ok: false,
        error: { code: "EMPTY_DOCUMENT", message: "Resume text is empty." },
        draft: {},
        warnings: ["Empty"],
      },
      draftContent: emptyDraftContent({
        personal: {},
        professional: {},
        experiences: [],
        educations: [],
        skills: [],
        projects: [],
        certifications: [],
      }),
    });

    const service = createCandidateFromResumeService(mockRepo);
    const draft = await service.parseForNewCandidate(hrSession, {
      fileName: "empty.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("%PDF"),
    });

    expect(draft.parseOk).toBe(false);
    expect(mockRepo.createCandidate).not.toHaveBeenCalled();
  });

  it("runs existing candidate validation (fullName required)", async () => {
    const service = createCandidateFromResumeService(mockRepo);
    const review = mapParsedDraftToReviewDefaults("intake-1", sampleMapped());
    review.candidate.fullName = "A";

    await expect(service.createFromReview(hrSession, review)).rejects.toBeInstanceOf(
      RecruitmentDomainError
    );
  });
});
