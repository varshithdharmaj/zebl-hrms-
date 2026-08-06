import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  CandidateSource,
  CandidateStatus,
  NoteVisibility,
} from "@/generated/prisma/enums";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";
import type { CandidateDetail, CandidateNoteView } from "@/lib/recruitment/candidate/types";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { writeAuditLog } from "@/lib/audit";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";

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

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    RECRUITMENT_CANDIDATE_NOTE_ADDED: "recruitment.candidate.note_added",
  },
  writeAuditLog: vi.fn(async () => undefined),
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

const superAdminSession: SessionUser = {
  ...hrSession,
  id: "user-sa",
  email: "sa@example.com",
  role: "super_admin",
  employeeId: 9,
  employeeName: "Super Admin",
};

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Employee User",
};

const recruiterSession: SessionUser = {
  ...employeeSession,
  id: "user-recruiter",
  email: "recruiter@example.com",
  employeeId: 3,
  employeeName: "Recruiter User",
};

const hiringManagerSession: SessionUser = {
  ...employeeSession,
  id: "user-hm",
  email: "hm@example.com",
  employeeId: 4,
  employeeName: "Hiring Manager",
};

function assignedScope(
  overrides: {
    jobOpeningIds?: readonly string[];
    applicationIds?: readonly string[];
    candidateIds?: readonly string[];
    capabilities?: Partial<RecruitmentScope["capabilities"]>;
  } = {}
): RecruitmentScope {
  return {
    mode: "assigned",
    jobOpeningIds: overrides.jobOpeningIds ?? ["job-1"],
    applicationIds: overrides.applicationIds ?? ["app-1"],
    candidateIds: overrides.candidateIds ?? ["cand-1"],
    capabilities: {
      isRecruiterOnJob: false,
      isHiringManager: false,
      isTeamLead: false,
      isInterviewer: false,
      ...overrides.capabilities,
    },
  };
}

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
    source: CandidateSource.manual_upload,
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

const sampleNote: CandidateNoteView = {
  id: "note-1",
  candidateId: "cand-1",
  body: "Strong communicator",
  content: "Strong communicator",
  visibility: NoteVisibility.team,
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
};

describe("CandidateService.addCandidateNote", () => {
  let mockRepo: CandidateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getCandidate: vi.fn(async () => baseCandidate()),
      addNote: vi.fn(async () => sampleNote),
    } as unknown as CandidateRepository;

    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      unrestrictedRecruitmentScope()
    );
  });

  it("allows HR to add discussion", async () => {
    const service = createCandidateService(mockRepo);
    const note = await service.addCandidateNote(hrSession, {
      candidateId: "cand-1",
      body: "  Strong communicator  ",
    });

    expect(note.id).toBe("note-1");
    expect(note.authorName).toBe("HR User");
    expect(mockRepo.addNote).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        body: "Strong communicator",
        content: "Strong communicator",
        visibility: NoteVisibility.team,
        authorUserId: "user-hr",
      }),
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CandidateNoteAdded",
        candidateId: "cand-1",
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "cand-1",
        action: "recruitment.candidate.note_added",
      })
    );
  });

  it("allows Super Admin to add discussion", async () => {
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(superAdminSession, {
        candidateId: "cand-1",
        body: "SA note",
      })
    ).resolves.toMatchObject({ id: "note-1" });
    expect(mockRepo.addNote).toHaveBeenCalled();
  });

  it("allows assigned recruiter to add discussion", async () => {
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      assignedScope({
        capabilities: { isRecruiterOnJob: true },
      })
    );
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(recruiterSession, {
        candidateId: "cand-1",
        body: "Recruiter note",
      })
    ).resolves.toMatchObject({ id: "note-1" });
  });

  it("allows hiring manager in scope to add discussion", async () => {
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      assignedScope({
        capabilities: { isHiringManager: true },
      })
    );
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(hiringManagerSession, {
        candidateId: "cand-1",
        body: "HM feedback",
      })
    ).resolves.toMatchObject({ id: "note-1" });
  });

  it("denies hiring manager outside candidate scope", async () => {
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      assignedScope({
        candidateIds: ["other-cand"],
        capabilities: { isHiringManager: true },
      })
    );
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(hiringManagerSession, {
        candidateId: "cand-1",
        body: "Out of scope",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.addNote).not.toHaveBeenCalled();
  });

  it("denies unauthorized employee", async () => {
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(
      assignedScope({
        candidateIds: [],
        capabilities: {},
      })
    );
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(employeeSession, {
        candidateId: "cand-1",
        body: "Should fail",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.addNote).not.toHaveBeenCalled();
  });

  it("returns author name from repository note view", async () => {
    const service = createCandidateService(mockRepo);
    const note = await service.addCandidateNote(hrSession, {
      candidateId: "cand-1",
      body: "Author check",
    });
    expect(note.authorName).toBe("HR User");
    expect(note.authorEmail).toBe("hr@example.com");
    expect(note.roleLabel).toBe("HR");
  });

  it("fails validation when body is empty", async () => {
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(hrSession, {
        candidateId: "cand-1",
        body: "   ",
      })
    ).rejects.toThrow(ZodError);
    expect(mockRepo.addNote).not.toHaveBeenCalled();
  });

  it("propagates repository failure", async () => {
    mockRepo.addNote = vi.fn(async () => {
      throw new Error("db write failed");
    });
    const service = createCandidateService(mockRepo);

    await expect(
      service.addCandidateNote(hrSession, {
        candidateId: "cand-1",
        body: "Will fail in repo",
      })
    ).rejects.toThrow("db write failed");
  });

  it("throws when candidate is not found", async () => {
    mockRepo.getCandidate = vi.fn(async () => null);
    const service = createCandidateService(mockRepo);

    await expect(
      service.addCandidateNote(hrSession, {
        candidateId: "missing",
        body: "No candidate",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });
});
