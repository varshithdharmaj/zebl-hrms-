import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
} from "@/generated/prisma/enums";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import type { CommunicationRepository } from "@/lib/recruitment/repositories/communication-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", () => ({
  RecruitmentScopeEngine: {
    getScope: vi.fn(async () => unrestrictedRecruitmentScope()),
    assertModuleActor: vi.fn(async () => unrestrictedRecruitmentScope()),
    assertCandidateInScope: vi.fn(),
    assertApplicationInScope: vi.fn(),
  },
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
  withRecruitmentTransaction: async <T>(work: (tx: Record<string, never>) => Promise<T>) =>
    work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/notifications/notification-queue", () => ({
  enqueueNotification: vi.fn(async () => "notif-1"),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    RECRUITMENT_COMMUNICATION_DRAFT_CREATED: "recruitment.communication.draft_created",
    RECRUITMENT_COMMUNICATION_UPDATED: "recruitment.communication.updated",
    RECRUITMENT_COMMUNICATION_SENT: "recruitment.communication.sent",
    RECRUITMENT_COMMUNICATION_DELETED: "recruitment.communication.deleted",
    RECRUITMENT_COMMUNICATION_ATTACHMENT_ADDED: "recruitment.communication.attachment_added",
    RECRUITMENT_COMMUNICATION_ATTACHMENT_REMOVED: "recruitment.communication.attachment_removed",
  },
  writeAuditLog: vi.fn(async () => undefined),
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

const managerSession: SessionUser = {
  id: "user-mgr",
  email: "mgr@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Manager",
  sessionVersion: 1,
  authProvider: "local",
};

function draftRecord(overrides: Partial<CommunicationRepository extends never ? never : Record<string, unknown>> = {}) {
  return {
    id: "comm-1",
    type: RecruitmentCommunicationType.email_sent,
    status: RecruitmentCommunicationStatus.draft,
    subject: "Hello",
    body: "Body",
    candidateId: "cand-1",
    applicationId: "app-1",
    jobOpeningId: "job-1",
    interviewId: null,
    offerId: null,
    templateId: null,
    senderUserId: "user-hr",
    recipientEmail: "cand@example.com",
    threadId: "comm-1",
    parentId: null,
    sentAt: null,
    deliveredAt: null,
    scheduledFor: null,
    errorMessage: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe("CommunicationService", () => {
  let mockRepo: CommunicationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createCommunication: vi.fn(async () => ({ id: "comm-1" })),
      updateCommunication: vi.fn(async () => undefined),
      getCommunication: vi.fn(async () => draftRecord()),
      listCommunications: vi.fn(async () => ({
        items: [draftRecord()],
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      })),
      searchCommunications: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
      })),
      getCommunicationThread: vi.fn(async () => [draftRecord()]),
      softDeleteCommunication: vi.fn(async () => undefined),
      createTemplate: vi.fn(async () => ({ id: "tpl-1" })),
      updateTemplate: vi.fn(async () => undefined),
      getTemplate: vi.fn(async () => null),
      listTemplates: vi.fn(async () => []),
      softDeleteTemplate: vi.fn(async () => undefined),
      addAttachment: vi.fn(async () => ({ id: "att-1" })),
      getAttachment: vi.fn(async () => null),
      getAttachments: vi.fn(async () => []),
      deleteAttachment: vi.fn(async () => undefined),
      restoreTemplate: vi.fn(async () => undefined),
      countByStatus: vi.fn(async () => 0),
      countDraftsByUser: vi.fn(async () => 2),
    };
  });

  it("creates a draft", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.createDraft(hrSession, {
      subject: "Interview invite",
      body: "Please join",
      candidateId: "cand-1",
      recipientEmail: "cand@example.com",
    });
    expect(result.id).toBe("comm-1");
    expect(mockRepo.createCommunication).toHaveBeenCalled();
  });

  it("rejects updating a sent message", async () => {
    vi.mocked(mockRepo.getCommunication).mockResolvedValue(
      draftRecord({ status: RecruitmentCommunicationStatus.sent }) as never
    );
    const service = createCommunicationService(mockRepo);
    await expect(
      service.updateDraft(hrSession, {
        id: "comm-1",
        subject: "Changed",
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("soft-deletes drafts only", async () => {
    const service = createCommunicationService(mockRepo);
    await service.deleteDraft(hrSession, "comm-1");
    expect(mockRepo.softDeleteCommunication).toHaveBeenCalledWith("comm-1", {});
  });

  it("sends an existing draft and marks it sent", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.sendMessage(hrSession, { id: "comm-1" });
    expect(result.id).toBe("comm-1");
    expect(mockRepo.updateCommunication).toHaveBeenCalled();
    const updateArg = vi.mocked(mockRepo.updateCommunication).mock.calls[0][1];
    expect(updateArg.status).toBe(RecruitmentCommunicationStatus.sent);
  });

  it("blocks hiring managers from writing", async () => {
    const { RecruitmentScopeEngine } = await import(
      "@/lib/recruitment/permissions/recruitment-scope-engine"
    );
    vi.mocked(RecruitmentScopeEngine.getScope).mockResolvedValue({
      mode: "assigned",
      jobOpeningIds: ["job-1"],
      applicationIds: ["app-1"],
      candidateIds: ["cand-1"],
      capabilities: {
        isRecruiterOnJob: false,
        isHiringManager: true,
        isTeamLead: false,
        isInterviewer: false,
      },
    });

    const service = createCommunicationService(mockRepo);
    await expect(
      service.createDraft(managerSession, {
        subject: "Note",
        body: "Private",
        candidateId: "cand-1",
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("searches with query", async () => {
    const service = createCommunicationService(mockRepo);
    await service.searchCommunications(hrSession, { query: "offer" });
    expect(mockRepo.searchCommunications).toHaveBeenCalled();
  });

  it("returns a thread", async () => {
    const service = createCommunicationService(mockRepo);
    const thread = await service.getThread(hrSession, "thread-1");
    expect(thread).toHaveLength(1);
  });

  it("adds attachments only to drafts", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.addAttachment(hrSession, {
      communicationId: "comm-1",
      fileName: "offer.pdf",
      fileType: "application/pdf",
      fileSize: 2048,
      storagePath: "communications/comm-1/attachments/offer.pdf",
    });
    expect(result.id).toBe("att-1");
    expect(mockRepo.addAttachment).toHaveBeenCalled();
  });

  it("rejects attachment upload for sent messages", async () => {
    vi.mocked(mockRepo.getCommunication).mockResolvedValue(
      draftRecord({ status: RecruitmentCommunicationStatus.sent }) as never
    );
    const service = createCommunicationService(mockRepo);
    await expect(
      service.addAttachment(hrSession, {
        communicationId: "comm-1",
        fileName: "offer.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        storagePath: "communications/comm-1/attachments/offer.pdf",
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("rejects unsupported attachment types", async () => {
    const service = createCommunicationService(mockRepo);
    await expect(
      service.addAttachment(hrSession, {
        communicationId: "comm-1",
        fileName: "malware.exe",
        fileType: "application/x-msdownload",
        fileSize: 2048,
        storagePath: "communications/comm-1/attachments/malware.exe",
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("duplicates a draft", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.duplicateDraft(hrSession, "comm-1");
    expect(result.id).toBe("comm-1");
    expect(mockRepo.createCommunication).toHaveBeenCalled();
  });

  it("removes attachments from drafts only", async () => {
    vi.mocked(mockRepo.getAttachment).mockResolvedValue({
      id: "att-1",
      communicationId: "comm-1",
      fileName: "offer.pdf",
      fileType: "application/pdf",
      fileSize: 2048,
      storagePath: "communications/comm-1/attachments/offer.pdf",
      uploadedAt: new Date(),
    });
    const service = createCommunicationService(mockRepo);
    const result = await service.removeAttachment(hrSession, "att-1");
    expect(result.id).toBe("att-1");
    expect(mockRepo.deleteAttachment).toHaveBeenCalledWith("att-1");
  });
});
