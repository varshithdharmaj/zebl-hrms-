import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import type { InterviewRepository } from "@/lib/recruitment/repositories/interview-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { writeAuditLog } from "@/lib/audit";
import { PermissionError } from "@/lib/permissions";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interview: {
      count: vi.fn(async () => 0),
    },
    employee: {
      findFirst: vi.fn(async () => ({ id: 1 })),
    },
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
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) =>
    work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    RECRUITMENT_INTERVIEW_UPDATED: "recruitment.interview.updated",
    RECRUITMENT_INTERVIEW_CANCELLED: "recruitment.interview.cancelled",
    RECRUITMENT_INTERVIEW_NO_SHOW: "recruitment.interview.no_show",
  },
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/repositories/prisma-application-repository", () => ({
  prismaApplicationRepository: {
    getApplication: vi.fn(async () => ({
      id: "app-1",
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    })),
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

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Panelist",
};

function baseInterview(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    applicationId: "app-1",
    roundType: InterviewRoundType.technical,
    status: InterviewStatus.scheduled,
    title: "Technical Interview",
    scheduledStart: "2026-08-04T10:00:00Z",
    scheduledEnd: "2026-08-04T11:00:00Z",
    panelists: [],
    application: {
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    },
    ...overrides,
  };
}

describe("InterviewService", () => {
  let mockRepo: InterviewRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createInterview: vi.fn(async () => ({ id: "int-1" })),
      updateInterview: vi.fn(async () => undefined),
      archiveInterview: vi.fn(async () => undefined),
      restoreInterview: vi.fn(async () => undefined),
      getInterview: vi.fn(async () => baseInterview()),
      listInterviews: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      })),
      searchInterviews: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      })),
      listByApplication: vi.fn(async () => []),
      listByScheduleRange: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      })),
      replacePanelists: vi.fn(async () => undefined),
      addAttachment: vi.fn(async () => ({ id: "att-1" })),
      softDeleteAttachment: vi.fn(async () => undefined),
      submitFeedback: vi.fn(async () => ({ id: "feed-1" })),
      listFeedback: vi.fn(async () => []),
      findFeedback: vi.fn(async () => null),
      countInterviews: vi.fn(async () => ({})),
    } as unknown as InterviewRepository;
  });

  it("creates interviews with scheduled status by default", async () => {
    const service = createInterviewService(mockRepo);
    const result = await service.createInterview(hrSession, {
      applicationId: "app-1",
      roundType: InterviewRoundType.technical,
      title: "Technical Round",
      scheduledStart: "2026-08-04T10:00:00Z",
      scheduledEnd: "2026-08-04T11:00:00Z",
    });

    expect(result.id).toBe("int-1");
    expect(mockRepo.createInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        status: InterviewStatus.scheduled,
        title: "Technical Round",
      }),
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "interview_scheduled" }),
      expect.anything()
    );
  });

  it("allows explicit draft status when requested", async () => {
    const service = createInterviewService(mockRepo);
    await service.createInterview(hrSession, {
      applicationId: "app-1",
      roundType: InterviewRoundType.technical,
      status: InterviewStatus.draft,
      title: "Draft Round",
      scheduledStart: "2026-08-04T10:00:00Z",
      scheduledEnd: "2026-08-04T11:00:00Z",
    });

    expect(mockRepo.createInterview).toHaveBeenCalledWith(
      expect.objectContaining({ status: InterviewStatus.draft }),
      expect.anything()
    );
  });

  it("updates interview, appends timeline, and writes audit", async () => {
    const service = createInterviewService(mockRepo);
    const result = await service.updateInterview(hrSession, {
      id: "int-1",
      title: "Rescheduled Round",
      scheduledStart: "2026-08-05T10:00:00Z",
      scheduledEnd: "2026-08-05T11:00:00Z",
      panelistEmployeeIds: [1, 2],
    });

    expect(result.applicationId).toBe("app-1");
    expect(mockRepo.updateInterview).toHaveBeenCalledWith(
      "int-1",
      expect.objectContaining({
        title: "Rescheduled Round",
        panelistEmployeeIds: [1, 2],
      }),
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "interview_updated" }),
      expect.anything()
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recruitment.interview.updated",
        entityId: "int-1",
      })
    );
  });

  it("rejects interview updates from non-HR users", async () => {
    const service = createInterviewService(mockRepo);
    await expect(
      service.updateInterview(employeeSession, {
        id: "int-1",
        title: "Nope",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.updateInterview).not.toHaveBeenCalled();
  });

  it("cancels interview with timeline and audit", async () => {
    const service = createInterviewService(mockRepo);
    const result = await service.cancelInterview(hrSession, "int-1");

    expect(result.applicationId).toBe("app-1");
    expect(mockRepo.updateInterview).toHaveBeenCalledWith(
      "int-1",
      { status: InterviewStatus.cancelled },
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "interview_cancelled" }),
      expect.anything()
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recruitment.interview.cancelled",
        entityId: "int-1",
      })
    );
  });

  it("rejects cancel from panelist / non-HR", async () => {
    const service = createInterviewService(mockRepo);
    await expect(service.cancelInterview(employeeSession, "int-1")).rejects.toThrow(
      PermissionError
    );
  });

  it("marks scheduled interview as no-show with timeline and audit", async () => {
    const service = createInterviewService(mockRepo);
    const result = await service.markNoShow(hrSession, "int-1");

    expect(result.applicationId).toBe("app-1");
    expect(mockRepo.updateInterview).toHaveBeenCalledWith(
      "int-1",
      { status: InterviewStatus.no_show },
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "interview_no_show" }),
      expect.anything()
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recruitment.interview.no_show",
        entityId: "int-1",
      })
    );
  });

  it("rejects no-show when interview is not scheduled", async () => {
    mockRepo.getInterview = vi.fn(async () =>
      baseInterview({ status: InterviewStatus.completed })
    );
    const service = createInterviewService(mockRepo);
    await expect(service.markNoShow(hrSession, "int-1")).rejects.toThrow(RecruitmentDomainError);
  });

  it("allows assigned panelist to submit feedback", async () => {
    mockRepo.getInterview = vi.fn(async () =>
      baseInterview({
        panelists: [{ employee: { user: { id: "user-emp" } } }],
      })
    );

    const service = createInterviewService(mockRepo);
    const result = await service.submitFeedback(employeeSession, {
      interviewId: "int-1",
      overallRating: 4,
      recommendation: "hire",
      strengths: "Strong fundamentals.",
    });

    expect(result).toBe("feed-1");
    expect(mockRepo.submitFeedback).toHaveBeenCalled();
  });

  it("rejects feedback from users who are not panelists or HR", async () => {
    mockRepo.getInterview = vi.fn(async () =>
      baseInterview({
        panelists: [{ employee: { user: { id: "someone-else" } } }],
      })
    );

    const service = createInterviewService(mockRepo);
    await expect(
      service.submitFeedback(employeeSession, {
        interviewId: "int-1",
        overallRating: 3,
        recommendation: "no_hire",
        strengths: "N/A",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("throws validation error when completing an already completed interview", async () => {
    mockRepo.getInterview = vi.fn(async () =>
      baseInterview({ status: InterviewStatus.completed })
    );

    const service = createInterviewService(mockRepo);
    await expect(service.completeInterview(hrSession, "int-1")).rejects.toThrow(
      RecruitmentDomainError
    );
  });
});
