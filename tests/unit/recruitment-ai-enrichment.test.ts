import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  computeCandidateFieldStatus,
  listMissingFieldLabels,
  SENSITIVE_MISSING_FIELDS,
} from "@/lib/recruitment/ai/field-status";
import { buildCandidateEnrichmentContext } from "@/lib/recruitment/ai/build-context";
import {
  enrichmentContainsSensitiveInventions,
  parseEnrichmentInsightContent,
  parseEnrichmentOutput,
} from "@/lib/recruitment/ai/enrichment-schema";
import {
  CANDIDATE_ENRICHMENT_CONTENT_KIND,
  CANDIDATE_ENRICHMENT_PROMPT_VERSION,
} from "@/lib/recruitment/ai/types";
import {
  computeEnrichmentInputFingerprint,
  enrichmentFingerprintsMatch,
} from "@/lib/recruitment/ai/enrichment-fingerprint";
import { buildCandidateEnrichmentUserPrompt } from "@/lib/recruitment/ai/prompt";
import {
  extractGitHubUrls,
  extractPortfolioUrls,
} from "@/lib/recruitment/resume-import/parser/patterns";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";

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
    linkedinUrl: "https://linkedin.com/in/alex",
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
    experiences: [
      {
        id: "e1",
        candidateId: "cand-1",
        company: "Acme",
        title: "Backend Engineer",
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: true,
        description: "Built APIs",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: "Acme",
        designation: "Backend Engineer",
        employmentType: null,
        currentlyWorking: true,
      },
    ],
    educations: [],
    skills: [
      {
        id: "s1",
        candidateId: "cand-1",
        name: "Node.js",
        proficiency: null,
        isConfirmed: true,
        createdAt: new Date(),
        skillName: "Node.js",
        yearsOfExperience: null,
      },
    ],
    projects: [],
    certifications: [],
    notes: [],
    ...overrides,
  };
}

describe("computeCandidateFieldStatus", () => {
  it("marks empty vs filled fields from candidate profile", () => {
    const status = computeCandidateFieldStatus(baseCandidate());
    expect(status.summary).toBe("empty");
    expect(status.headline).toBe("empty");
    expect(status.experience).toBe("filled");
    expect(status.skills).toBe("filled");
    expect(status.githubUrl).toBe("empty");
    expect(status.noticePeriod).toBe("empty");
    expect(status.expectedCtc).toBe("empty");
  });

  it("lists missing labels including sensitive gaps", () => {
    const status = computeCandidateFieldStatus(baseCandidate());
    const missing = listMissingFieldLabels(status);
    expect(missing).toContain("Professional summary");
    expect(missing).toContain("Expected CTC");
    expect(missing).toContain("Notice period");
    for (const key of SENSITIVE_MISSING_FIELDS) {
      expect(status[key]).toBe("empty");
    }
  });

  it("marks summary/headline filled when present", () => {
    const status = computeCandidateFieldStatus(
      baseCandidate({
        professionalSummary: "Existing summary",
        headline: "Existing headline",
      })
    );
    expect(status.summary).toBe("filled");
    expect(status.headline).toBe("filled");
  });
});

describe("buildCandidateEnrichmentContext", () => {
  it("sends filled/empty status only — never sensitive compensation values", () => {
    const ctx = buildCandidateEnrichmentContext({
      candidate: baseCandidate({
        expectedCtc: "20" as never,
        noticePeriodDays: 60,
      }),
    });
    const serialized = JSON.stringify(ctx);
    // Status keys are OK; inventable values must not appear.
    expect(ctx.fieldStatus.expectedCtc).toBe("filled");
    expect(ctx.fieldStatus.noticePeriod).toBe("filled");
    expect(serialized).not.toMatch(/"expectedCtc"\s*:\s*"?20/);
    expect(serialized).not.toMatch(/noticePeriodDays/);
    expect(serialized).not.toContain("60");
    expect(ctx.skills).toContain("Node.js");
  });

  it("builds user prompt from structured evidence without email PII", () => {
    const ctx = buildCandidateEnrichmentContext({ candidate: baseCandidate() });
    const prompt = buildCandidateEnrichmentUserPrompt(ctx);
    expect(prompt).toContain("Backend Engineer");
    expect(prompt).toContain("missingFields");
    expect(prompt).toContain("fieldStatus");
    expect(prompt).toContain('"summary":"empty"');
    expect(prompt).toContain('"experience":"filled"');
    expect(prompt).not.toContain("alex@example.com");
  });

  it("exposes app-owned missing fields including Notice period without inventing values", () => {
    const ctx = buildCandidateEnrichmentContext({ candidate: baseCandidate() });
    expect(ctx.fieldStatus.noticePeriod).toBe("empty");
    expect(ctx.fieldStatus.experience).toBe("filled");
    expect(ctx.missingFields).toContain("Notice period");
    expect(ctx.missingFields).toContain("GitHub URL");
    expect(ctx.missingFields.join(" ")).not.toMatch(/\d+\s*days/i);
  });
});

describe("enrichment Zod validation", () => {
  it("accepts valid enrichment output", () => {
    const result = parseEnrichmentOutput({
      summary: "Experienced backend engineer.",
      headline: "Backend Engineer · Node.js",
      strengths: ["API design", "Node.js"],
      missingInformation: ["Notice period", "Expected CTC"],
      interviewTopics: ["Node.js architecture", "REST APIs"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malformed enrichment output", () => {
    const result = parseEnrichmentOutput({
      summary: "",
      headline: "x",
      strengths: [],
      missingInformation: [],
      interviewTopics: [],
    });
    expect(result.ok).toBe(false);
  });

  it("parses insight content envelope", () => {
    const result = parseEnrichmentInsightContent({
      version: 1,
      kind: CANDIDATE_ENRICHMENT_CONTENT_KIND,
      promptVersion: CANDIDATE_ENRICHMENT_PROMPT_VERSION,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
      fieldStatus: computeCandidateFieldStatus(baseCandidate()),
      enrichment: {
        summary: "Suggested summary",
        headline: "Suggested headline",
        strengths: ["A"],
        missingInformation: ["Notice period"],
        interviewTopics: ["APIs"],
      },
      applied: { summary: false, headline: false },
    });
    expect(result.ok).toBe(true);
  });

  it("flags invented sensitive values in generated prose", () => {
    expect(
      enrichmentContainsSensitiveInventions({
        summary: "Expecting 25 LPA compensation.",
        headline: "Engineer",
        strengths: ["Node"],
        missingInformation: ["Notice period"],
        interviewTopics: ["APIs"],
      })
    ).toBe(true);

    expect(
      enrichmentContainsSensitiveInventions({
        summary: "Backend engineer focused on APIs.",
        headline: "Backend Engineer",
        strengths: ["Node.js"],
        missingInformation: ["Expected CTC", "Notice period"],
        interviewTopics: ["REST APIs"],
      })
    ).toBe(false);
  });
});

describe("parser github/portfolio helpers", () => {
  it("extracts github and portfolio urls deterministically", () => {
    const header = [
      "Alex",
      "github.com/alexdev",
      "Portfolio: https://alex.dev",
      "alex@example.com",
    ];
    const text = header.join("\n");
    expect(extractGitHubUrls(text)[0]).toMatch(/github\.com\/alexdev/i);
    expect(
      extractPortfolioUrls(text, { headerLines: header })[0]
    ).toMatch(/alex\.dev/i);
  });
});

describe("tryGenerateFromResumeDraft gating", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/recruitment/ai/config");
    vi.resetModules();
  });

  it("skips when API key missing / AI disabled", async () => {
    vi.doMock("@/lib/recruitment/ai/config", () => ({
      getAiRuntimeConfig: async () => ({
        enabled: false,
        apiKey: null,
        model: "x",
        reasonDisabled: "GEMINI_API_KEY is not configured.",
      }),
      getGeminiApiKey: () => null,
      getGeminiModel: () => "x",
    }));

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );

    const provider = {
      id: "mock",
      generateCandidateEnrichment: vi.fn(async () => ({
        ok: false as const,
        error: "should not be called",
      })),
      generateResumeFieldRecovery: vi.fn(async () => ({ ok: true as const, data: [], modelId: 'mock-model' })),
    };

    const repo = {
      getCandidate: vi.fn(),
      getInsight: vi.fn(),
      listInsights: vi.fn(),
      createInsight: vi.fn(),
      updateInsightStatus: vi.fn(),
      updateCandidate: vi.fn(),
    };

    const service = createCandidateAiEnrichmentService(repo as never, provider);
    const result = await service.tryGenerateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
    });

    expect(result.skipped).toMatch(/GEMINI_API_KEY|disabled/i);
    expect(provider.generateCandidateEnrichment).not.toHaveBeenCalled();
  });

  it("computes a stable enrichment input fingerprint and ignores CTC/notice/email", () => {
    const a = computeEnrichmentInputFingerprint({
      candidate: baseCandidate({
        currentCtc: "50" as never,
        noticePeriodDays: 30,
        email: "alex@example.com",
        phone: "+919999999999",
      }),
      mapped: null,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
    });
    const b = computeEnrichmentInputFingerprint({
      candidate: baseCandidate({
        currentCtc: "99" as never,
        noticePeriodDays: 90,
        email: "other@example.com",
        phone: "+911111111111",
        status: "on_hold" as never,
      }),
      mapped: null,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);

    const changedSkills = computeEnrichmentInputFingerprint({
      candidate: baseCandidate({
        skills: [
          {
            id: "s2",
            candidateId: "cand-1",
            name: "Go",
            proficiency: null,
            isConfirmed: true,
            createdAt: new Date(),
            skillName: "Go",
            yearsOfExperience: null,
          },
        ],
      }),
      mapped: null,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
    });
    expect(enrichmentFingerprintsMatch(a, changedSkills)).toBe(false);

    const skillOrderA = computeEnrichmentInputFingerprint({
      candidate: baseCandidate({
        skills: [
          {
            id: "s1",
            candidateId: "cand-1",
            name: "Node.js",
            proficiency: null,
            isConfirmed: true,
            createdAt: new Date(),
            skillName: "Node.js",
            yearsOfExperience: null,
          },
          {
            id: "s2",
            candidateId: "cand-1",
            name: "Go",
            proficiency: null,
            isConfirmed: true,
            createdAt: new Date(),
            skillName: "Go",
            yearsOfExperience: null,
          },
        ],
      }),
      mapped: null,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
    });
    const skillOrderB = computeEnrichmentInputFingerprint({
      candidate: baseCandidate({
        skills: [
          {
            id: "s2",
            candidateId: "cand-1",
            name: "Go",
            proficiency: null,
            isConfirmed: true,
            createdAt: new Date(),
            skillName: "Go",
            yearsOfExperience: null,
          },
          {
            id: "s1",
            candidateId: "cand-1",
            name: "Node.js",
            proficiency: null,
            isConfirmed: true,
            createdAt: new Date(),
            skillName: "Node.js",
            yearsOfExperience: null,
          },
        ],
      }),
      mapped: null,
      documentId: "doc-1",
      sourceDraftId: "draft-1",
    });
    expect(skillOrderA).toBe(skillOrderB);
  });

  it("swallows provider failure so resume import can continue", async () => {
    vi.doMock("@/lib/recruitment/ai/config", () => ({
      getAiRuntimeConfig: async () => ({
        enabled: true,
        apiKey: "k",
        model: "m",
        reasonDisabled: null,
      }),
      getGeminiApiKey: () => "k",
      getGeminiModel: () => "m",
    }));

    const { createCandidateAiEnrichmentService } = await import(
      "@/lib/recruitment/services/candidate-ai-enrichment-service"
    );
    const { buildStubResumeImportContent } = await import(
      "@/lib/recruitment/resume-import/stub-draft"
    );
    const { AiInsightType, AiInsightStatus } = await import(
      "@/generated/prisma/enums"
    );

    const draft = buildStubResumeImportContent({ documentId: "doc-1" });
    const createInsight = vi.fn();
    const repo = {
      getCandidate: vi.fn(async () => baseCandidate()),
      getInsight: vi.fn(async () => ({
        id: "draft-1",
        candidateId: "cand-1",
        insightType: AiInsightType.resume_parse,
        status: AiInsightStatus.pending_review,
        contentJson: draft,
      })),
      listInsights: vi.fn(async () => []),
      createInsight,
      updateInsightStatus: vi.fn(),
      updateCandidate: vi.fn(),
    };

    const provider = {
      id: "mock",
      async generateCandidateEnrichment() {
        return { ok: false as const, error: "boom", retryable: false };
      },
      async generateResumeFieldRecovery() {
        return { ok: true as const, data: [], modelId: "mock-model" };
      },
    };

    const service = createCandidateAiEnrichmentService(repo as never, provider);
    const result = await service.tryGenerateFromResumeDraft({
      candidateId: "cand-1",
      sourceDraftId: "draft-1",
    });

    expect(result.error).toBeTruthy();
    expect(createInsight).not.toHaveBeenCalled();
  });
});
