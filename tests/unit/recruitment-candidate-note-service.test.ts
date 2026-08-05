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

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
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

    vi.spyOn(RecruitmentScopeEngine, "canManageCandidate").mockResolvedValue(true);
  });

  it("successfully adds a note with timeline and audit", async () => {
    const service = createCandidateService(mockRepo);
    const note = await service.addCandidateNote(hrSession, {
      candidateId: "cand-1",
      body: "  Strong communicator  ",
    });

    expect(note.id).toBe("note-1");
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

  it("denies permission for non-HR sessions", async () => {
    const service = createCandidateService(mockRepo);
    await expect(
      service.addCandidateNote(employeeSession, {
        candidateId: "cand-1",
        body: "Should fail",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.addNote).not.toHaveBeenCalled();
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

  it("throws when candidate is outside scope", async () => {
    vi.spyOn(RecruitmentScopeEngine, "canManageCandidate").mockResolvedValue(false);
    const service = createCandidateService(mockRepo);

    await expect(
      service.addCandidateNote(hrSession, {
        candidateId: "cand-1",
        body: "Out of scope",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.addNote).not.toHaveBeenCalled();
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
