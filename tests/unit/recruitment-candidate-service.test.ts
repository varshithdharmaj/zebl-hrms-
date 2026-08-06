import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { normalizeEmail, normalizePhone } from "@/lib/recruitment/candidate/candidate-normalizer";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
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
  publishAfterCommit: vi.fn(),
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
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
    fullName: "John Doe",
    firstName: "John",
    lastName: "Doe",
    preferredName: null,
    email: "john.doe@example.com",
    phone: "+1234567890",
    alternatePhone: null,
    dateOfBirth: null,
    location: "New York",
    currentCompany: "Acme Corp",
    currentTitle: "Software Engineer",
    linkedinUrl: null,
    professionalSummary: null,
    headline: null,
    totalExperienceYears: null,
    githubUrl: null,
    preferredWorkMode: null,
    willingToRelocate: null,
    source: CandidateSource.manual,
    status: CandidateStatus.active,
    doNotHireReason: null,
    currentCtc: null,
    expectedCtc: null,
    currency: "USD",
    noticePeriodDays: null,
    earliestJoinDate: null,
    availabilityNotes: null,
    timezone: null,
    primaryRecruiterUserId: null,
    referredByEmployeeId: null,
    employeeId: null,
    mergedIntoCandidateId: null,
    createdByUserId: "user-hr",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    normalizedEmail: "john.doe@example.com",
    normalizedPhone: "1234567890",
    personal: null,
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    certifications: [],
    documents: [],
    notes: [],
    ...overrides,
  };
}

describe("Candidate Normalization Helpers", () => {
  it("normalizes email correctly", () => {
    expect(normalizeEmail(" John.DOE@gmail.com ")).toBe("john.doe@gmail.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("normalizes phone correctly", () => {
    expect(normalizePhone(" +1 (234) 567-8901 ")).toBe("12345678901");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("Candidate Service Layer", () => {
  let mockRepo: CandidateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createCandidate: vi.fn(async () => ({ id: "cand-1" })),
      updateCandidate: vi.fn(async () => undefined),
      softDeleteCandidate: vi.fn(async () => undefined),
      setStatus: vi.fn(async () => undefined),
      getCandidate: vi.fn(async () => null),
      findByEmail: vi.fn(async () => null),
      findByPhone: vi.fn(async () => null),
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
      setTags: vi.fn(),
      addTalentPoolEntry: vi.fn(),
      closeTalentPoolEntry: vi.fn(),
      createInsight: vi.fn(),
      updateInsightStatus: vi.fn(),
      createIntake: vi.fn(),
      updateIntake: vi.fn(),
      findIntake: vi.fn(),
      listIntake: vi.fn(),
      archiveCandidate: vi.fn(),
      restoreCandidate: vi.fn(),
      findByNormalizedEmail: vi.fn(async () => null),
      findByNormalizedPhone: vi.fn(async () => null),
      findDuplicateCandidates: vi.fn(async () => []),
      addNote: vi.fn(async () => ({
        id: "note-1",
        candidateId: "cand-1",
        body: "x",
        content: "x",
        visibility: "team",
        isPinned: false,
        isResolved: false,
        authorUserId: "user-hr",
        authorName: "HR User",
        authorEmail: "hr@example.com",
        avatarUrl: null,
        roleLabel: "HR",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })),
    };
  });

  describe("createCandidate", () => {
    it("successfully creates a candidate with normalized fields", async () => {
      const service = createCandidateService(mockRepo);
      const result = await service.createCandidate(hrSession, {
        fullName: "John Doe",
        email: "John.DOE@example.com",
        phone: "+12345678901",
      });

      expect(result.id).toBe("cand-1");
      expect(mockRepo.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "John Doe",
          normalizedEmail: "john.doe@example.com",
          normalizedPhone: "12345678901",
        }),
        expect.anything()
      );
    });

    it("maps preferred location and portfolio into personal on create", async () => {
      const service = createCandidateService(mockRepo);
      await service.createCandidate(hrSession, {
        fullName: "Alex Rivera",
        headline: "Senior React Developer | 5 Years",
        professionalSummary: "Product-minded engineer.",
        totalExperienceYears: "5",
        githubUrl: "https://github.com/alex",
        preferredWorkMode: "hybrid" as const,
        willingToRelocate: true,
        preferredLocation: "Pune",
        portfolioUrl: "https://alex.dev",
      });

      expect(mockRepo.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: "Senior React Developer | 5 Years",
          professionalSummary: "Product-minded engineer.",
          totalExperienceYears: "5",
          githubUrl: "https://github.com/alex",
          preferredWorkMode: "hybrid",
          willingToRelocate: true,
          personal: expect.objectContaining({
            preferredLocation: "Pune",
            portfolioUrl: "https://alex.dev",
          }),
        }),
        expect.anything()
      );
    });

    it("blocks creation if normalized email already exists", async () => {
      const service = createCandidateService(mockRepo);
      const existing = baseCandidate({ id: "cand-existing", email: "john.doe@example.com" });
      mockRepo.findByNormalizedEmail = vi.fn(async () => existing);

      await expect(
        service.createCandidate(hrSession, {
          fullName: "John Doe",
          email: "john.doe@example.com",
        })
      ).rejects.toThrow(RecruitmentDomainError);
    });

    it("blocks creation if normalized phone already exists", async () => {
      const service = createCandidateService(mockRepo);
      const existing = baseCandidate({ id: "cand-existing", phone: "+1234567890" });
      mockRepo.findByNormalizedPhone = vi.fn(async () => existing);

      await expect(
        service.createCandidate(hrSession, {
          fullName: "John Doe",
          phone: "+1234567890",
        })
      ).rejects.toThrow(RecruitmentDomainError);
    });

    it("allows creating candidate without email or phone", async () => {
      const service = createCandidateService(mockRepo);
      const result = await service.createCandidate(hrSession, {
        fullName: "John Doe",
      });
      expect(result.id).toBe("cand-1");
    });

    it("throws validation error if more than one primary resume is provided", async () => {
      const service = createCandidateService(mockRepo);
      await expect(
        service.createCandidate(hrSession, {
          fullName: "John Doe",
          documents: [
            { documentType: "resume", fileName: "resume1.pdf", storageKey: "key1", isPrimary: true },
            { documentType: "resume", fileName: "resume2.pdf", storageKey: "key2", isPrimary: true },
          ],
        })
      ).rejects.toThrow(RecruitmentDomainError);
    });
  });

  describe("updateCandidate", () => {
    it("successfully updates candidate fields", async () => {
      const service = createCandidateService(mockRepo);
      const existing = baseCandidate({ id: "cand-1" });
      mockRepo.getCandidate = vi.fn(async () => existing);

      await service.updateCandidate(hrSession, "cand-1", {
        fullName: "John Updated",
      });

      expect(mockRepo.updateCandidate).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          fullName: "John Updated",
        }),
        expect.anything()
      );
    });

    it("updates profile fields and preserves personal nationality", async () => {
      mockRepo.getCandidate = vi.fn(async () =>
        baseCandidate({
          personal: {
            candidateId: "cand-1",
            nationality: "IN",
            currentLocation: null,
            preferredLocation: "Delhi",
            noticePeriod: null,
            availabilityDate: null,
            linkedinUrl: null,
            portfolioUrl: null,
          },
        })
      );

      const service = createCandidateService(mockRepo);
      await service.updateCandidate(hrSession, "cand-1", {
        headline: "Staff Engineer",
        preferredLocation: "Hyderabad",
        portfolioUrl: "https://portfolio.example",
      });

      expect(mockRepo.updateCandidate).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          headline: "Staff Engineer",
          personal: expect.objectContaining({
            nationality: "IN",
            preferredLocation: "Hyderabad",
            portfolioUrl: "https://portfolio.example",
          }),
        }),
        expect.anything()
      );
    });

    it("updates nationality via form convenience field", async () => {
      mockRepo.getCandidate = vi.fn(async () =>
        baseCandidate({
          personal: {
            candidateId: "cand-1",
            nationality: null,
            currentLocation: null,
            preferredLocation: "Delhi",
            noticePeriod: null,
            availabilityDate: null,
            linkedinUrl: null,
            portfolioUrl: null,
          },
        })
      );

      const service = createCandidateService(mockRepo);
      await service.updateCandidate(hrSession, "cand-1", {
        nationality: "Indian",
      });

      expect(mockRepo.updateCandidate).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          personal: expect.objectContaining({
            nationality: "Indian",
            preferredLocation: "Delhi",
          }),
        }),
        expect.anything()
      );
    });

    it("throws error if candidate to update is not found", async () => {
      const service = createCandidateService(mockRepo);
      await expect(
        service.updateCandidate(hrSession, "cand-nonexistent", {
          fullName: "John Updated",
        })
      ).rejects.toThrow(RecruitmentDomainError);
    });
  });

  describe("archive and restore", () => {
    it("archives an active candidate", async () => {
      const service = createCandidateService(mockRepo);
      const existing = baseCandidate({ id: "cand-1" });
      mockRepo.getCandidate = vi.fn(async () => existing);

      await service.archiveCandidate(hrSession, "cand-1");
      expect(mockRepo.archiveCandidate).toHaveBeenCalledWith("cand-1", expect.anything());
    });

    it("restores an archived candidate", async () => {
      const service = createCandidateService(mockRepo);
      const existing = baseCandidate({ id: "cand-1", archivedAt: new Date() });
      mockRepo.getCandidate = vi.fn(async () => existing);

      await service.restoreCandidate(hrSession, "cand-1");
      expect(mockRepo.restoreCandidate).toHaveBeenCalledWith("cand-1", expect.anything());
    });
  });

  describe("mergeCandidate", () => {
    it("successfully merges source candidate into target candidate", async () => {
      const service = createCandidateService(mockRepo);
      const source = baseCandidate({ id: "cand-source" });
      const target = baseCandidate({ id: "cand-target" });
      mockRepo.getCandidate = vi.fn(async (id) => (id === "cand-source" ? source : target));

      await service.mergeCandidate(hrSession, "cand-source", "cand-target");

      expect(mockRepo.markMerged).toHaveBeenCalledWith("cand-source", "cand-target", expect.anything());
      expect(mockRepo.archiveCandidate).toHaveBeenCalledWith("cand-source", expect.anything());
    });

    it("throws error if trying to merge candidate into themselves", async () => {
      const service = createCandidateService(mockRepo);
      await expect(
        service.mergeCandidate(hrSession, "cand-1", "cand-1")
      ).rejects.toThrow(RecruitmentDomainError);
    });

    it("throws error if source candidate is already merged", async () => {
      const service = createCandidateService(mockRepo);
      const source = baseCandidate({ id: "cand-source", status: CandidateStatus.merged });
      const target = baseCandidate({ id: "cand-target" });
      mockRepo.getCandidate = vi.fn(async (id) => (id === "cand-source" ? source : target));

      await expect(
        service.mergeCandidate(hrSession, "cand-source", "cand-target")
      ).rejects.toThrow(RecruitmentDomainError);
    });
  });
});
