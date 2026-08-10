import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import { createResumeImportService } from "@/lib/recruitment/services/resume-import-service";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import {
  buildStubResumeImportContent,
  parseResumeImportDraftContent,
} from "@/lib/recruitment/resume-import";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";

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

function baseCandidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    id: "cand-1",
    tenantId: null,
    fullName: "Pat Existing",
    firstName: "Pat",
    lastName: "Existing",
    preferredName: null,
    email: "pat@example.com",
    phone: "+10000000000",
    alternatePhone: null,
    dateOfBirth: null,
    location: "Pune",
    currentCompany: "Old Co",
    currentTitle: "Engineer",
    linkedinUrl: null,
    professionalSummary: "Existing summary",
    headline: "Existing headline",
    totalExperienceYears: "4",
    githubUrl: null,
    preferredWorkMode: null,
    willingToRelocate: null,
    source: "manual" as never,
    status: "active" as never,
    doNotHireReason: null,
    currentCtc: "1000000",
    expectedCtc: null,
    currency: "INR",
    noticePeriodDays: 30,
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
    normalizedEmail: "pat@example.com",
    normalizedPhone: "10000000000",
    personal: {
      nationality: null,
      currentLocation: null,
      preferredLocation: "Hyderabad",
      noticePeriod: null,
      availabilityDate: null,
      linkedinUrl: null,
      portfolioUrl: null,
    },
    experiences: [
      {
        id: "exp-1",
        company: "Old Co",
        title: "Engineer",
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: true,
        description: null,
        sortOrder: 0,
        companyName: "Old Co",
        designation: "Engineer",
        employmentType: null,
        currentlyWorking: true,
      },
    ],
    educations: [],
    skills: [{ id: "sk-1", name: "Java", proficiency: null, isConfirmed: true, skillName: "Java", yearsOfExperience: null }],
    projects: [],
    certifications: [],
    documents: [],
    notes: [],
    tags: [],
    ...overrides,
  } as CandidateDetail;
}

describe("ResumeImportService", () => {
  let mockRepo: CandidateRepository;
  let insights: Array<Record<string, unknown>>;
  let candidate: CandidateDetail;

  beforeEach(() => {
    insights = [];
    candidate = baseCandidate();

    mockRepo = {
      getCandidate: vi.fn(async (id: string) =>
        id === candidate.id ? candidate : null
      ),
      getCandidateDocument: vi.fn(async (id: string) =>
        id === "doc-1"
          ? {
              id: "doc-1",
              candidateId: "cand-1",
              deletedAt: null,
              documentType: "resume",
            }
          : null
      ),
      createInsight: vi.fn(async (candidateId, data) => {
        const id = `insight-${insights.length + 1}`;
        insights.push({
          id,
          candidateId,
          ...data,
        });
        return { id };
      }),
      getInsight: vi.fn(async (id: string) => insights.find((i) => i.id === id) ?? null),
      listInsights: vi.fn(async (candidateId, filters) =>
        insights.filter((i) => {
          if (i.candidateId !== candidateId) return false;
          if (filters?.insightType && i.insightType !== filters.insightType) return false;
          if (filters?.status && i.status !== filters.status) return false;
          return true;
        })
      ),
      updateInsightStatus: vi.fn(async (id, status, _tx, meta) => {
        const row = insights.find((i) => i.id === id);
        if (row) {
          row.status = status;
          if (meta?.reviewedByUserId !== undefined) {
            row.reviewedByUserId = meta.reviewedByUserId;
          }
          if (meta?.reviewedAt !== undefined) row.reviewedAt = meta.reviewedAt;
        }
      }),
      updateCandidate: vi.fn(async (id, patch) => {
        if (id === candidate.id) Object.assign(candidate, patch);
      }),
      upsertExperience: vi.fn(async () => ({ id: "exp-new" })),
      upsertEducation: vi.fn(async () => ({ id: "edu-new" })),
      upsertSkill: vi.fn(async () => ({ id: "sk-new" })),
      upsertProject: vi.fn(async (_id, data) => {
        candidate.projects.push({
          id: `proj-${candidate.projects.length + 1}`,
          candidateId: "cand-1",
          title: String(data.title),
          summary: (data.summary as string) ?? null,
          techStack: (data.techStack as string) ?? null,
          url: (data.url as string) ?? null,
          sortOrder: (data.sortOrder as number) ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: (data.summary as string) ?? null,
          technologies: (data.techStack as string) ?? null,
          role: null,
          duration: (data.duration as string) ?? null,
        });
        return { id: `proj-${candidate.projects.length}` };
      }),
      upsertCertification: vi.fn(async (_id, data) => {
        candidate.certifications.push({
          id: `cert-${candidate.certifications.length + 1}`,
          candidateId: "cand-1",
          name: String(data.name),
          issuer: (data.issuer as string) ?? null,
          issuedAt: data.issuedAt ? new Date(String(data.issuedAt)) : null,
          expiresAt: null,
          credentialId: (data.credentialId as string) ?? null,
          createdAt: new Date(),
          issueDate: null,
          expiryDate: null,
          credentialUrl: (data.credentialUrl as string) ?? null,
        });
        return { id: `cert-${candidate.certifications.length}` };
      }),
      replaceSection: vi.fn(async (candidateId, section, rows) => {
        if (candidateId !== candidate.id) return;
        if (section === "skills") {
          candidate.skills = rows.map((r, idx) => ({
            id: `sk-new-${idx}`,
            name: String(r.name),
            proficiency: (r.proficiency as string) ?? null,
            isConfirmed: true,
            skillName: String(r.name),
            yearsOfExperience: (r.yearsOfExperience as number) ?? null,
          })) as never;
        }
        if (section === "experiences") {
          candidate.experiences = rows as never;
        }
      }),
      findByNormalizedEmail: vi.fn(async () => null),
      findByNormalizedPhone: vi.fn(async () => null),
    } as unknown as CandidateRepository;

    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue({
      mode: "unrestricted",
      jobOpeningIds: [],
      applicationIds: [],
      candidateIds: [],
      capabilities: {
        isRecruiterOnJob: true,
        isHiringManager: true,
        isTeamLead: true,
        isInterviewer: true,
      },
    });
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(
      () => undefined
    );
    vi.mocked(RecruitmentTimelineService.append).mockClear();
  });

  it("creates a pending_review resume_parse draft from stub content", async () => {
    const service = createResumeImportService(mockRepo);
    const stub = buildStubResumeImportContent({
      documentId: "doc-1",
      candidateHint: { fullName: candidate.fullName, email: candidate.email },
    });
    const { id } = await service.createDraft(hrSession, {
      candidateId: "cand-1",
      documentId: "doc-1",
      content: stub,
    });

    expect(id).toBe("insight-1");
    expect(mockRepo.createInsight).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        insightType: AiInsightType.resume_parse,
        status: AiInsightStatus.pending_review,
      }),
      expect.anything()
    );

    const content = parseResumeImportDraftContent(insights[0].contentJson);
    expect(content.source).toBe("stub");
    expect(content.documentId).toBe("doc-1");
    expect(content.mapped.professional.headline).toBeTruthy();
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "resume_import_draft_created",
        metadata: expect.not.objectContaining({
          rawText: expect.anything(),
        }),
      }),
      expect.anything()
    );
  });

  it("supersedes previous pending draft for the same document", async () => {
    const service = createResumeImportService(mockRepo);
    const stub = buildStubResumeImportContent({
      documentId: "doc-1",
      candidateHint: { fullName: candidate.fullName, email: candidate.email },
    });
    const first = await service.createDraft(hrSession, {
      candidateId: "cand-1",
      documentId: "doc-1",
      content: stub,
    });
    const second = await service.createDraft(hrSession, {
      candidateId: "cand-1",
      documentId: "doc-1",
      content: stub,
    });

    expect(first.id).toBe("insight-1");
    expect(second.id).toBe("insight-2");
    expect(insights[0].status).toBe(AiInsightStatus.superseded);
    expect(insights[1].status).toBe(AiInsightStatus.pending_review);
  });

  it("dismisses a pending draft", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });
    await service.dismissDraft(hrSession, id);

    expect(insights[0].status).toBe(AiInsightStatus.dismissed);
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "resume_import_dismissed" }),
      expect.anything()
    );
  });

  it("keeps current scalars by default and only applies accepted fields", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });

    await service.applyDraft(hrSession, {
      draftId: id,
      candidateId: "cand-1",
      scalarDecisions: [
        { key: "headline", action: "accept" },
        { key: "professionalSummary", action: "ignore" },
        { key: "location", action: "ignore" },
      ],
      sectionDecisions: [],
    });

    expect(mockRepo.updateCandidate).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        headline: expect.any(String),
      }),
      expect.anything()
    );
    const patch = vi.mocked(mockRepo.updateCandidate).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(patch.professionalSummary).toBeUndefined();
    expect(patch.location).toBeUndefined();
    expect(patch.currentCtc).toBeUndefined();
    expect(patch.noticePeriodDays).toBeUndefined();
    expect(insights[0].status).toBe(AiInsightStatus.accepted);
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "resume_import_applied" }),
      expect.anything()
    );
  });

  it("applies nested section via replaceSection when accepted", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });

    await service.applyDraft(hrSession, {
      draftId: id,
      candidateId: "cand-1",
      scalarDecisions: [],
      sectionDecisions: [{ section: "skills", action: "accept" }],
    });

    expect(mockRepo.replaceSection).toHaveBeenCalledWith(
      "cand-1",
      "skills",
      expect.arrayContaining([expect.objectContaining({ name: "TypeScript" })]),
      expect.anything()
    );
    expect(candidate.skills.some((s) => s.name === "TypeScript")).toBe(true);
  });

  it("rejects denied fields even if accepted", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });

    await expect(
      service.applyDraft(hrSession, {
        draftId: id,
        candidateId: "cand-1",
        scalarDecisions: [{ key: "currentCtc", action: "accept", editedValue: "9" }],
        sectionDecisions: [],
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("rolls back apply when a repository write fails (insight stays pending)", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });

    mockRepo.updateCandidate = vi.fn(async () => {
      throw new Error("db write failed");
    });

    await expect(
      service.applyDraft(hrSession, {
        draftId: id,
        candidateId: "cand-1",
        scalarDecisions: [{ key: "headline", action: "accept" }],
        sectionDecisions: [],
      })
    ).rejects.toThrow("db write failed");

    expect(insights[0].status).toBe(AiInsightStatus.pending_review);
    expect(mockRepo.updateInsightStatus).not.toHaveBeenCalledWith(
      id,
      AiInsightStatus.accepted,
      expect.anything(),
      expect.anything()
    );
  });

  it("accepts edited scalar values over stub mapped values", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });

    await service.applyDraft(hrSession, {
      draftId: id,
      candidateId: "cand-1",
      scalarDecisions: [
        { key: "headline", action: "accept", editedValue: "Custom Headline" },
      ],
      sectionDecisions: [],
    });

    expect(mockRepo.updateCandidate).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({ headline: "Custom Headline" }),
      expect.anything()
    );
  });

  it("allows future parser content via createDraft(content)", async () => {
    const service = createResumeImportService(mockRepo);
    const content = buildStubResumeImportContent({ documentId: null });
    content.source = "parser";
    content.mapped.professional.headline = "Parsed Headline";
    content.metadata.parserVersion = "rules-v1";

    const { id } = await service.createDraft(hrSession, {
      candidateId: "cand-1",
      content,
    });

    const stored = parseResumeImportDraftContent(insights[0].contentJson);
    expect(id).toBeTruthy();
    expect(stored.source).toBe("parser");
    expect(stored.mapped.professional.headline).toBe("Parsed Headline");
  });

  it("builds review diffs with conflict highlighting", async () => {
    const service = createResumeImportService(mockRepo);
    const { id } = await service.createDraft(hrSession, { candidateId: "cand-1" });
    const review = await service.getReview(hrSession, id);

    const headline = review.scalars.find((s) => s.key === "headline");
    expect(headline?.status === "conflict" || headline?.status === "changed").toBe(
      true
    );
    expect(review.sections.some((s) => s.section === "skills")).toBe(true);
  });

  it("applyMerge persists projects and certifications via upsert helpers", async () => {
    const service = createResumeImportService(mockRepo);
    const stub = buildStubResumeImportContent({ documentId: "doc-1" });
    // Avoid scalar conflicts so merge can focus on list appends.
    stub.mapped.personal.fullName = candidate.fullName;
    stub.mapped.personal.firstName = candidate.firstName;
    stub.mapped.personal.lastName = candidate.lastName;
    stub.mapped.personal.email = candidate.email;
    stub.mapped.personal.phone = candidate.phone;
    stub.mapped.personal.location = candidate.location;
    stub.mapped.professional.headline = candidate.headline;
    stub.mapped.professional.professionalSummary = candidate.professionalSummary;
    stub.mapped.professional.currentCompany = candidate.currentCompany;
    stub.mapped.professional.currentTitle = candidate.currentTitle;
    stub.mapped.professional.totalExperienceYears = candidate.totalExperienceYears;

    const { id } = await service.createDraft(hrSession, {
      candidateId: "cand-1",
      documentId: "doc-1",
      content: stub,
    });

    const result = await service.applyMerge(hrSession, {
      draftId: id,
      candidateId: "cand-1",
      conflictSelections: {},
    });

    expect(mockRepo.upsertProject).toHaveBeenCalled();
    expect(mockRepo.upsertCertification).toHaveBeenCalled();
    expect(result.appended).toEqual(
      expect.arrayContaining(["project", "certification"])
    );
    expect(candidate.projects.some((p) => p.title === "Recruitment Workspace")).toBe(
      true
    );
    expect(
      candidate.certifications.some((c) =>
        /AWS Certified Developer/i.test(c.name)
      )
    ).toBe(true);
  });
});