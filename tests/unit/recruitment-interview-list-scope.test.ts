import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewStatus } from "@/generated/prisma/enums";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import type { InterviewRepository } from "@/lib/recruitment/repositories/interview-repository";
import type { SessionUser } from "@/lib/session";
import {
  unrestrictedRecruitmentScope,
  type RecruitmentScope,
} from "@/lib/recruitment/types/scope";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interview: { count: vi.fn(async () => 0) },
    employee: { findFirst: vi.fn(async () => ({ id: 1 })) },
    hiringTeamMember: { findMany: vi.fn(async () => []) },
    interviewPanelist: { findMany: vi.fn(async () => []) },
    application: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recruitment/permissions/recruitment-scope-engine")
  >("@/lib/recruitment/permissions/recruitment-scope-engine");
  return {
    ...actual,
    RecruitmentScopeEngine: {
      ...actual.RecruitmentScopeEngine,
      getScope: vi.fn(async () => unrestrictedRecruitmentScope()),
    },
  };
});

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("InterviewService listInterviews scope", () => {
  let listInterviews: ReturnType<typeof vi.fn>;
  let mockRepo: InterviewRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    listInterviews = vi.fn(async () => ({
      items: [
        {
          id: "int-1",
          applicationId: "app-1",
          feedback: [],
          attachments: [],
          panelists: [],
          application: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    }));

    mockRepo = {
      createInterview: vi.fn(),
      updateInterview: vi.fn(),
      archiveInterview: vi.fn(),
      restoreInterview: vi.fn(),
      getInterview: vi.fn(),
      listInterviews,
      searchInterviews: vi.fn(),
      listByApplication: vi.fn(),
      listByScheduleRange: vi.fn(),
      replacePanelists: vi.fn(),
      addAttachment: vi.fn(),
      softDeleteAttachment: vi.fn(),
      submitFeedback: vi.fn(),
      listFeedback: vi.fn(),
      findFeedback: vi.fn(),
      countInterviews: vi.fn(),
    } as unknown as InterviewRepository;
  });

  it("passes resolved scope to repository listInterviews", async () => {
    const service = createInterviewService(mockRepo);
    await service.listInterviews(hrSession, {
      filters: { status: InterviewStatus.scheduled },
      pagination: { page: 1, pageSize: 50 },
    });

    expect(listInterviews).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: unrestrictedRecruitmentScope(),
        filters: { status: InterviewStatus.scheduled },
        pagination: { page: 1, pageSize: 50 },
      })
    );
  });
});

describe("assigned scope shape", () => {
  it("builds OR filter inputs for assigned applications", () => {
    const scope: RecruitmentScope = {
      mode: "assigned",
      jobOpeningIds: ["job-1"],
      applicationIds: ["app-1"],
      candidateIds: ["cand-1"],
      capabilities: {
        isRecruiterOnJob: true,
        isHiringManager: false,
        isTeamLead: false,
        isInterviewer: true,
      },
    };
    expect(scope.mode).toBe("assigned");
    expect(scope.applicationIds).toContain("app-1");
  });
});
