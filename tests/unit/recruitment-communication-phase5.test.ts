import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
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
  createAfterCommitBuffer: () => ({
    push: vi.fn(),
    publishAll: vi.fn(async () => undefined),
    enqueue: vi.fn(),
    flush: vi.fn(async () => undefined),
    size: 0,
  }),
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: Record<string, never>) => Promise<T>) =>
    work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: { append: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/notifications/notification-queue", () => ({
  enqueueNotification: vi.fn(async () => "notif-1"),
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    RECRUITMENT_COMMUNICATION_DRAFT_CREATED: "x",
    RECRUITMENT_COMMUNICATION_UPDATED: "x",
    RECRUITMENT_COMMUNICATION_SENT: "x",
    RECRUITMENT_COMMUNICATION_DELETED: "x",
    RECRUITMENT_COMMUNICATION_ATTACHMENT_ADDED: "x",
    RECRUITMENT_COMMUNICATION_ATTACHMENT_REMOVED: "x",
    RECRUITMENT_COMMUNICATION_SCHEDULED: "scheduled",
    RECRUITMENT_COMMUNICATION_SCHEDULE_CANCELLED: "cancelled",
    RECRUITMENT_TEMPLATE_CREATED: "tpl_created",
    RECRUITMENT_TEMPLATE_UPDATED: "tpl_updated",
    RECRUITMENT_TEMPLATE_DELETED: "tpl_deleted",
  },
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/communication/default-template-store", () => ({
  getDefaultEmailTemplateMap: vi.fn(async () => ({})),
  setDefaultEmailTemplate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recruitmentSettings: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => undefined),
    },
  },
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

function draftRecord(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "comm-1",
    type: RecruitmentCommunicationType.email_sent,
    status: RecruitmentCommunicationStatus.draft,
    subject: "Hello",
    body: "Body",
    candidateId: "cand-1",
    applicationId: null,
    jobOpeningId: null,
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

describe("Communication Phase 5", () => {
  let mockRepo: CommunicationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createCommunication: vi.fn(async () => ({ id: "comm-2" })),
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
      getCommunicationThread: vi.fn(async () => []),
      softDeleteCommunication: vi.fn(async () => undefined),
      createTemplate: vi.fn(async () => ({ id: "tpl-1" })),
      updateTemplate: vi.fn(async () => undefined),
      getTemplate: vi.fn(async () => ({
        id: "tpl-1",
        name: "Custom Invite",
        type: RecruitmentEmailTemplateType.interview_invitation,
        subject: "Hi {{candidateName}}",
        body: "Body",
        isSystem: false,
        isActive: true,
        createdByUserId: "user-hr",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })),
      listTemplates: vi.fn(async () => []),
      softDeleteTemplate: vi.fn(async () => undefined),
      restoreTemplate: vi.fn(async () => undefined),
      addAttachment: vi.fn(async () => ({ id: "att-1" })),
      getAttachment: vi.fn(async () => null),
      getAttachments: vi.fn(async () => []),
      deleteAttachment: vi.fn(async () => undefined),
      countByStatus: vi.fn(async () => 3),
      countDraftsByUser: vi.fn(async () => 2),
    };
  });

  it("creates a custom email template", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.createEmailTemplate(hrSession, {
      name: "Custom",
      type: RecruitmentEmailTemplateType.general,
      subject: "Hello {{candidateName}}",
      body: "Welcome to {{company}}",
    });
    expect(result.id).toBe("tpl-1");
    expect(mockRepo.createTemplate).toHaveBeenCalled();
  });

  it("blocks editing built-in system templates", async () => {
    const service = createCommunicationService(mockRepo);
    await expect(
      service.updateEmailTemplate(hrSession, {
        id: "system:general",
        subject: "Changed",
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("duplicates a system template into a custom draft", async () => {
    const service = createCommunicationService(mockRepo);
    const result = await service.duplicateEmailTemplate(
      hrSession,
      "system:interview_invitation"
    );
    expect(result.id).toBe("tpl-1");
    expect(mockRepo.createTemplate).toHaveBeenCalled();
  });

  it("schedules a draft for the future", async () => {
    const service = createCommunicationService(mockRepo);
    const scheduledFor = new Date(Date.now() + 3_600_000).toISOString();
    const result = await service.scheduleMessage(hrSession, {
      id: "comm-1",
      scheduledFor,
    });
    expect(result.id).toBe("comm-1");
    expect(mockRepo.updateCommunication).toHaveBeenCalled();
    const patch = vi.mocked(mockRepo.updateCommunication).mock.calls[0]?.[1];
    expect(patch?.status).toBe(RecruitmentCommunicationStatus.scheduled);
  });

  it("rejects scheduling in the past", async () => {
    const service = createCommunicationService(mockRepo);
    await expect(
      service.scheduleMessage(hrSession, {
        id: "comm-1",
        scheduledFor: new Date(Date.now() - 3_600_000).toISOString(),
      })
    ).rejects.toBeInstanceOf(RecruitmentDomainError);
  });

  it("cancels a schedule back to draft", async () => {
    vi.mocked(mockRepo.getCommunication).mockResolvedValue(
      draftRecord({ status: RecruitmentCommunicationStatus.scheduled }) as never
    );
    const service = createCommunicationService(mockRepo);
    const result = await service.cancelSchedule(hrSession, "comm-1");
    expect(result.id).toBe("comm-1");
    const patch = vi.mocked(mockRepo.updateCommunication).mock.calls[0]?.[1];
    expect(patch?.status).toBe(RecruitmentCommunicationStatus.draft);
    expect(patch?.scheduledFor).toBeNull();
  });

  it("marks expired scheduled items in the queue", async () => {
    vi.mocked(mockRepo.listCommunications).mockResolvedValue({
      items: [
        draftRecord({
          status: RecruitmentCommunicationStatus.scheduled,
          scheduledFor: new Date(Date.now() - 60_000),
        }) as never,
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    const service = createCommunicationService(mockRepo);
    const queue = await service.listScheduledQueue(hrSession, { page: 1 });
    expect(queue.items[0]?.isExpired).toBe(true);
  });

  it("returns communication analytics shape", async () => {
    const service = createCommunicationService(mockRepo);
    const analytics = await service.getCommunicationAnalytics(hrSession);
    expect(analytics.emailsSent).toBeGreaterThanOrEqual(0);
    expect(analytics.openRatePlaceholder).toBeNull();
    expect(Array.isArray(analytics.templateUsage)).toBe(true);
    expect(Array.isArray(analytics.messagesByRecruiter)).toBe(true);
  });

  it("test-renders template variables including aliases", async () => {
    const service = createCommunicationService(mockRepo);
    const rendered = service.testRenderTemplate(hrSession, {
      subject: "Interview on {{interviewDate}}",
      body: "Offer {{offerAmount}}",
      variables: { date: "2026-08-12", offerSalary: "100000" },
    });
    expect(rendered.subject).toContain("2026-08-12");
    expect(rendered.body).toContain("100000");
  });
});
