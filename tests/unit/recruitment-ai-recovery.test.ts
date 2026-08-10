import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  RESUME_FIELD_RECOVERY_CONTENT_KIND,
  RESUME_FIELD_RECOVERY_PROMPT_VERSION,
} from "@/lib/recruitment/ai/recovery-types";
import { listEligibleRecoveryFields } from "@/lib/recruitment/ai/recovery-eligible";
import { parseRecoveryModelOutput } from "@/lib/recruitment/ai/recovery-schema";
import {
  buildResumeFieldRecoveryContext,
  sanitizeResumeTextForRecovery,
} from "@/lib/recruitment/ai/recovery-context";
import {
  computeRecoveryInputFingerprint,
  hashResumeText,
} from "@/lib/recruitment/ai/recovery-fingerprint";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  createCandidateAiRecoveryService,
  RECOVERY_FIELD_FILLED_MESSAGE,
  RECOVERY_STALE_ACCEPT_MESSAGE,
} from "@/lib/recruitment/services/candidate-ai-recovery-service";
import { buildStubResumeImportContent } from "@/lib/recruitment/resume-import/stub-draft";
import { logger } from "@/lib/observability/logger";

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

vi.mock("@/lib/recruitment/storage/recruitment-storage", () => ({
  getRecruitmentStorage: () => ({
    exists: async () => true,
    read: async () => Buffer.from("Alex Candidate\nBengaluru\nTypeScript\n"),
  }),
}));

vi.mock("@/lib/recruitment/resume-import/parser/extract-text", () => ({
  extractResumeText: async () => ({
    ok: true as const,
    extraction: { text: "Alex Candidate\nLocation: Remote City\nSkills: TypeScript, Node.js\n" },
  }),
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
    location: null,
    currentCompany: null,
    currentTitle: null,
    linkedinUrl: null,
    professionalSummary: null,
    headline: null,
    totalExperienceYears: null,
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

function recoveryContent(
  candidate: CandidateDetail,
  overrides: Record<string, unknown> = {}
) {
  const resumeText =
    "Alex Candidate\nLocation: Remote City\nSkills: TypeScript, Node.js\n";
  const resumeTextHash = hashResumeText(resumeText);
  const documentId = (overrides.documentId as string | null | undefined) ?? "doc-1";
  const sourceDraftId =
    (overrides.sourceDraftId as string | null | undefined) ?? "draft-1";
  const inputFingerprint =
    (overrides.inputFingerprint as string | undefined) ??
    computeRecoveryInputFingerprint({
      candidate,
      documentId,
      sourceDraftId,
      resumeTextHash,
    });
  return {
    version: 1 as const,
    kind: RESUME_FIELD_RECOVERY_CONTENT_KIND,
    promptVersion: RESUME_FIELD_RECOVERY_PROMPT_VERSION,
    documentId,
    sourceDraftId,
    inputFingerprint,
    resumeTextHash,
    eligibleFields: listEligibleRecoveryFields(candidate),
    proposals: [
      {
        id: "prop-location",
        field: "location" as const,
        value: "Remote City",
        confidence: "high" as const,
        evidence: "Location: Remote City",
        applied: false,
      },
      {
        id: "prop-skill",
        field: "skill" as const,
        value: "TypeScript",
        confidence: "medium" as const,
        evidence: "Skills: TypeScript, Node.js",
        applied: false,
      },
    ],
    ...overrides,
  };
}

describe("resume field recovery — schema & eligibility", () => {
  it("lists only empty eligible fields and excludes sensitive ones", () => {
    const empty = listEligibleRecoveryFields(baseCandidate());
    expect(empty).toContain("location");
    expect(empty).toContain("skill");
    expect(empty).not.toContain("email" as never);
    expect(empty).not.toContain("phone" as never);

    const filled = listEligibleRecoveryFields(
      baseCandidate({
        location: "Pune",
        headline: "Engineer",
        professionalSummary: "Summary",
        githubUrl: "https://github.com/a",
        linkedinUrl: "https://linkedin.com/in/a",
        personal: {
          candidateId: "cand-1",
          nationality: null,
          currentLocation: null,
          preferredLocation: null,
          noticePeriod: null,
          availabilityDate: null,
          linkedinUrl: null,
          portfolioUrl: "https://portfolio.example",
        },
        experiences: [{ id: "e1", company: "Acme", title: "Dev" } as never],
        educations: [{ id: "ed1", institution: "IIT" } as never],
        skills: [{ id: "s1", name: "Go" } as never],
        projects: [{ id: "p1", title: "App" } as never],
        certifications: [{ id: "c1", name: "AWS" } as never],
      })
    );
    expect(filled).toEqual([]);
  });

  it("rejects malformed, unsupported, and sensitive model proposals", () => {
    expect(parseRecoveryModelOutput(null).ok).toBe(false);
    expect(parseRecoveryModelOutput({ proposals: "nope" }).ok).toBe(false);

    const parsed = parseRecoveryModelOutput({
      proposals: [
        {
          field: "email",
          value: "x@y.com",
          confidence: "high",
          evidence: "Email: x@y.com",
        },
        {
          field: "location",
          value: "Pune",
          confidence: "low",
          evidence: "Location: Pune",
        },
        {
          field: "location",
          value: "12 LPA CTC",
          confidence: "high",
          evidence: "Compensation 12 LPA",
        },
        {
          field: "location",
          value: "Remote City",
          confidence: "high",
          evidence: "Location: Remote City",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.value).toBe("Remote City");
  });

  it("redacts email/phone from recovery context and omits CTC/notice", () => {
    const text = sanitizeResumeTextForRecovery(
      "Alex alex@example.com +91 99999 99999\nCTC 20 LPA notice 30 days"
    );
    expect(text).toContain("[email]");
    expect(text).toContain("[phone]");
    expect(text).not.toContain("alex@example.com");

    const ctx = buildResumeFieldRecoveryContext({
      candidate: baseCandidate({
        email: "secret@example.com",
        phone: "+911111111111",
        currentCtc: "50" as never,
        noticePeriodDays: 30,
      }),
      resumeText: "Contact secret@example.com phone +91 22222 22222\nLocation: Goa",
      eligibleFields: ["location"],
    });
    expect(JSON.stringify(ctx)).not.toContain("secret@example.com");
    expect(JSON.stringify(ctx)).not.toMatch(/\+91\s*22222/);
    expect(ctx).not.toHaveProperty("currentCtc");
    expect(ctx.parsedCandidate).not.toHaveProperty("email");
    expect(ctx.parsedCandidate).not.toHaveProperty("phone");
  });
});

describe("resume field recovery — service lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      unrestrictedRecruitmentScope()
    );
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(
      () => undefined
    );
  });

  it("generates pending recovery only for empty eligible fields", async () => {
    const candidate = baseCandidate({ location: "Already set" });
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const createInsight = vi.fn(async () => ({ id: "rec-1" }));
    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(),
      generateResumeFieldRecovery: vi.fn(async (ctx) => {
        expect(ctx.eligibleFields).not.toContain("location");
        expect(ctx.eligibleFields).toContain("headline");
        return {
          ok: true as const,
          data: [
            {
              field: "location" as const,
              value: "Should be dropped",
              confidence: "high" as const,
              evidence: "ignored",
            },
            {
              field: "headline" as const,
              value: "Backend Engineer",
              confidence: "high" as const,
              evidence: "Title line",
            },
          ],
          modelId: "mock",
        };
      }),
    };
    const repo = {
      getCandidate: vi.fn(async () => candidate),
      getInsight: vi.fn(async () => ({
        id: "draft-1",
        candidateId: "cand-1",
        insightType: AiInsightType.resume_parse,
        status: AiInsightStatus.pending_review,
        contentJson: draft,
      })),
      getCandidateDocument: vi.fn(async () => ({
        id: "doc-1",
        candidateId: "cand-1",
        storageKey: "k",
        fileName: "r.pdf",
        mimeType: "application/pdf",
      })),
      listInsights: vi.fn(async () => []),
      createInsight,
      updateInsightStatus: vi.fn(),
      updateCandidate: vi.fn(),
      upsertSkill: vi.fn(),
      upsertExperience: vi.fn(),
      upsertEducation: vi.fn(),
      upsertProject: vi.fn(),
      upsertCertification: vi.fn(),
    };

    const service = createCandidateAiRecoveryService(repo as never, provider);
    const result = await service.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: true,
    });

    expect(result.insightId).toBe("rec-1");
    expect(createInsight).toHaveBeenCalled();
    const content = createInsight.mock.calls[0]?.[1]?.contentJson as {
      proposals: Array<{ field: string }>;
    };
    expect(content.proposals.map((p) => p.field)).toEqual(["headline"]);
    expect(content.proposals.every((p) => p.field !== "location")).toBe(true);
  });

  it("provider failure does not throw through tryGenerate", async () => {
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const createInsight = vi.fn();
    const service = createCandidateAiRecoveryService(
      {
        getCandidate: vi.fn(async () => baseCandidate()),
        getInsight: vi.fn(async () => ({
          id: "draft-1",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_parse,
          contentJson: draft,
        })),
        getCandidateDocument: vi.fn(async () => ({
          id: "doc-1",
          candidateId: "cand-1",
          storageKey: "k",
          fileName: "r.pdf",
          mimeType: "application/pdf",
        })),
        listInsights: vi.fn(async () => []),
        createInsight,
        updateInsightStatus: vi.fn(),
        updateCandidate: vi.fn(),
      } as never,
      {
        id: "mock",
        generateCandidateEnrichment: vi.fn(),
        generateResumeFieldRecovery: vi.fn(async () => ({
          ok: false as const,
          error: "gemini down",
          retryable: false,
        })),
      }
    );

    const result = await service.tryGenerateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
    });
    expect(result.error).toMatch(/gemini down|AI field recovery/i);
    expect(createInsight).not.toHaveBeenCalled();
  });

  it("accept applies only selected fields; dismiss leaves candidate unchanged", async () => {
    const candidate = baseCandidate();
    const content = recoveryContent(candidate);
    const updateCandidate = vi.fn();
    const upsertSkill = vi.fn();
    const repo = {
      getCandidate: vi.fn(async () => candidate),
      getInsight: vi.fn(async () => ({
        id: "rec-1",
        candidateId: "cand-1",
        insightType: AiInsightType.resume_field_recovery,
        status: AiInsightStatus.pending_review,
        contentJson: content,
      })),
      getCandidateDocument: vi.fn(async () => ({
        id: "doc-1",
        candidateId: "cand-1",
        storageKey: "k",
        fileName: "r.pdf",
        mimeType: "application/pdf",
      })),
      listInsights: vi.fn(async () => []),
      createInsight: vi.fn(),
      updateInsightStatus: vi.fn(),
      updateCandidate,
      upsertSkill,
      upsertExperience: vi.fn(),
      upsertEducation: vi.fn(),
      upsertProject: vi.fn(),
      upsertCertification: vi.fn(),
    };
    const service = createCandidateAiRecoveryService(repo as never, {
      id: "mock",
      generateCandidateEnrichment: vi.fn(),
      generateResumeFieldRecovery: vi.fn(),
    });

    const accepted = await service.acceptRecoveryProposals(hrSession, {
      insightId: "rec-1",
      candidateId: "cand-1",
      proposalIds: ["prop-location"],
      editedValues: { "prop-location": "Edited City" },
    });
    expect(accepted.applied).toEqual(["location"]);
    expect(updateCandidate).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({ location: "Edited City" }),
      expect.anything()
    );
    expect(upsertSkill).not.toHaveBeenCalled();

    updateCandidate.mockClear();
    await service.dismissRecovery(hrSession, {
      insightId: "rec-1",
      candidateId: "cand-1",
    });
    expect(updateCandidate).not.toHaveBeenCalled();
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(
      "rec-1",
      AiInsightStatus.dismissed,
      expect.anything(),
      expect.anything()
    );
  });

  it("rejects accept when field filled after generation or fingerprint stale", async () => {
    const candidate = baseCandidate({ location: "Filled later" });
    const emptyAtGen = baseCandidate();
    const content = recoveryContent(emptyAtGen);
    const service = createCandidateAiRecoveryService(
      {
        getCandidate: vi.fn(async () => candidate),
        getInsight: vi.fn(async () => ({
          id: "rec-1",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_field_recovery,
          status: AiInsightStatus.pending_review,
          contentJson: content,
        })),
        getCandidateDocument: vi.fn(async () => ({
          id: "doc-1",
          candidateId: "cand-1",
          storageKey: "k",
          fileName: "r.pdf",
          mimeType: "application/pdf",
        })),
        listInsights: vi.fn(async () => []),
        createInsight: vi.fn(),
        updateInsightStatus: vi.fn(),
        updateCandidate: vi.fn(),
        upsertSkill: vi.fn(),
      } as never,
      {
        id: "mock",
        generateCandidateEnrichment: vi.fn(),
        generateResumeFieldRecovery: vi.fn(),
      }
    );

    await expect(
      service.acceptRecoveryProposals(hrSession, {
        insightId: "rec-1",
        candidateId: "cand-1",
        proposalIds: ["prop-location"],
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(
        new RegExp(`${RECOVERY_FIELD_FILLED_MESSAGE}|${RECOVERY_STALE_ACCEPT_MESSAGE}`)
      ),
    });

    const staleCandidate = baseCandidate();
    const staleService = createCandidateAiRecoveryService(
      {
        getCandidate: vi.fn(async () => staleCandidate),
        getInsight: vi.fn(async () => ({
          id: "rec-2",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_field_recovery,
          status: AiInsightStatus.pending_review,
          contentJson: recoveryContent(staleCandidate, {
            inputFingerprint: "deadbeef",
          }),
        })),
        getCandidateDocument: vi.fn(async () => ({
          id: "doc-1",
          candidateId: "cand-1",
          storageKey: "k",
          fileName: "r.pdf",
          mimeType: "application/pdf",
        })),
        listInsights: vi.fn(async () => []),
        createInsight: vi.fn(),
        updateInsightStatus: vi.fn(),
        updateCandidate: vi.fn(),
      } as never,
      {
        id: "mock",
        generateCandidateEnrichment: vi.fn(),
        generateResumeFieldRecovery: vi.fn(),
      }
    );

    await expect(
      staleService.acceptRecoveryProposals(hrSession, {
        insightId: "rec-2",
        candidateId: "cand-1",
        proposalIds: ["prop-location"],
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
    await expect(
      staleService.acceptRecoveryProposals(hrSession, {
        insightId: "rec-2",
        candidateId: "cand-1",
        proposalIds: ["prop-location"],
      })
    ).rejects.toMatchObject({ message: RECOVERY_STALE_ACCEPT_MESSAGE });
  });

  it("rejects candidateId mismatch, unauthorized role, and out-of-scope", async () => {
    const content = recoveryContent(baseCandidate());
    const repo = {
      getCandidate: vi.fn(async () => baseCandidate()),
      getInsight: vi.fn(async () => ({
        id: "rec-1",
        candidateId: "cand-1",
        insightType: AiInsightType.resume_field_recovery,
        status: AiInsightStatus.pending_review,
        contentJson: content,
      })),
      getCandidateDocument: vi.fn(),
      listInsights: vi.fn(async () => []),
      createInsight: vi.fn(),
      updateInsightStatus: vi.fn(),
      updateCandidate: vi.fn(),
    };
    const service = createCandidateAiRecoveryService(repo as never, {
      id: "mock",
      generateCandidateEnrichment: vi.fn(),
      generateResumeFieldRecovery: vi.fn(),
    });

    await expect(
      service.dismissRecovery(hrSession, {
        insightId: "rec-1",
        candidateId: "cand-OTHER",
      })
    ).rejects.toMatchObject({ message: /does not belong/i });

    await expect(
      service.dismissRecovery(employeeSession, {
        insightId: "rec-1",
        candidateId: "cand-1",
      })
    ).rejects.toBeTruthy();

    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(
      () => {
        throw new RecruitmentDomainError("REC_FORBIDDEN", "Out of scope.");
      }
    );
    await expect(
      service.dismissRecovery(hrSession, {
        insightId: "rec-1",
        candidateId: "cand-1",
      })
    ).rejects.toMatchObject({ message: /Out of scope/i });
  });

  it("reuses pending recovery with matching fingerprint (no duplicate)", async () => {
    const candidate = baseCandidate();
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const resumeText =
      "Alex Candidate\nLocation: Remote City\nSkills: TypeScript, Node.js\n";
    const existing = recoveryContent(candidate, {
      inputFingerprint: computeRecoveryInputFingerprint({
        candidate,
        documentId: "doc-1",
        sourceDraftId: "draft-1",
        resumeTextHash: hashResumeText(resumeText),
      }),
    });
    const createInsight = vi.fn();
    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(),
      generateResumeFieldRecovery: vi.fn(),
    };
    const service = createCandidateAiRecoveryService(
      {
        getCandidate: vi.fn(async () => candidate),
        getInsight: vi.fn(async () => ({
          id: "draft-1",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_parse,
          contentJson: draft,
        })),
        getCandidateDocument: vi.fn(async () => ({
          id: "doc-1",
          candidateId: "cand-1",
          storageKey: "k",
          fileName: "r.pdf",
          mimeType: "application/pdf",
        })),
        listInsights: vi.fn(async () => [
          {
            id: "rec-existing",
            status: AiInsightStatus.pending_review,
            contentJson: existing,
          },
        ]),
        createInsight,
        updateInsightStatus: vi.fn(),
        updateCandidate: vi.fn(),
      } as never,
      provider
    );

    const result = await service.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: false,
    });
    expect(result.reused).toBe(true);
    expect(result.insightId).toBe("rec-existing");
    expect(provider.generateResumeFieldRecovery).not.toHaveBeenCalled();
    expect(createInsight).not.toHaveBeenCalled();
  });

  it("does not log sensitive payloads", async () => {
    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const service = createCandidateAiRecoveryService(
      {
        getCandidate: vi.fn(async () => baseCandidate()),
        getInsight: vi.fn(async () => ({
          id: "draft-1",
          candidateId: "cand-1",
          insightType: AiInsightType.resume_parse,
          contentJson: draft,
        })),
        getCandidateDocument: vi.fn(async () => ({
          id: "doc-1",
          candidateId: "cand-1",
          storageKey: "k",
          fileName: "r.pdf",
          mimeType: "application/pdf",
        })),
        listInsights: vi.fn(async () => []),
        createInsight: vi.fn(async () => ({ id: "rec-1" })),
        updateInsightStatus: vi.fn(),
        updateCandidate: vi.fn(),
      } as never,
      {
        id: "mock",
        generateCandidateEnrichment: vi.fn(),
        generateResumeFieldRecovery: vi.fn(async () => ({
          ok: true as const,
          data: [
            {
              field: "location" as const,
              value: "Remote City",
              confidence: "high" as const,
              evidence: "Location: Remote City",
            },
          ],
          modelId: "mock",
          rawText: "SECRET_PROMPT_AND_KEY",
        })),
      }
    );

    await service.generateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
      session: hrSession,
      force: true,
    });

    const payloads = [logger.info, logger.warn, logger.error].flatMap((fn) =>
      (fn as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.stringify(c))
    );
    expect(payloads.join("\n")).not.toContain("SECRET_PROMPT_AND_KEY");
    expect(payloads.join("\n")).not.toContain("test-key");
  });
});
