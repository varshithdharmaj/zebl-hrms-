import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import {
  createInterviewAction,
  updateInterviewAction,
  cancelInterviewAction,
  completeInterviewAction,
  submitInterviewFeedbackAction,
  archiveInterviewAction,
  restoreInterviewAction,
} from "@/actions/recruitment-interviews";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
    userId: "user-hr",
  }),
  getSessionOrThrow: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
    userId: "user-hr",
  }),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const mockCreateInterview = vi.fn(async () => ({ id: "int-1" }));
const mockUpdateInterview = vi.fn(async () => ({ applicationId: "app-1" }));
const mockCancelInterview = vi.fn(async () => ({ applicationId: "app-1" }));
const mockCompleteInterview = vi.fn(async () => undefined);
const mockSubmitFeedback = vi.fn(async () => ({ id: "feed-1" }));
const mockArchiveInterview = vi.fn(async () => undefined);
const mockRestoreInterview = vi.fn(async () => undefined);

vi.mock("@/lib/recruitment/services/interview-service", () => ({
  createInterviewService: () => ({
    createInterview: (...args: any[]) => (mockCreateInterview as any)(...args),
    updateInterview: (...args: any[]) => (mockUpdateInterview as any)(...args),
    cancelInterview: (...args: any[]) => (mockCancelInterview as any)(...args),
    completeInterview: (...args: any[]) => (mockCompleteInterview as any)(...args),
    submitFeedback: (...args: any[]) => (mockSubmitFeedback as any)(...args),
    archiveInterview: (...args: any[]) => (mockArchiveInterview as any)(...args),
    restoreInterview: (...args: any[]) => (mockRestoreInterview as any)(...args),
  }),
}));

describe("Interview Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should schedule interview via action", async () => {
    const res = await createInterviewAction(
      {},
      {
        applicationId: "app-1",
        roundType: InterviewRoundType.technical,
        title: "Technical Interview",
        scheduledStart: "2026-08-04T10:00:00Z",
        scheduledEnd: "2026-08-04T11:00:00Z",
      }
    );

    expect(res.success).toBeDefined();
    expect(res.interviewId).toBe("int-1");
    expect(mockCreateInterview).toHaveBeenCalled();
  });

  it("should update interview via action", async () => {
    const res = await updateInterviewAction(
      {},
      {
        id: "int-1",
        title: "Updated Technical Interview",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockUpdateInterview).toHaveBeenCalled();
  });

  it("should cancel interview via action", async () => {
    const res = await cancelInterviewAction(
      {},
      {
        id: "int-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockCancelInterview).toHaveBeenCalled();
  });

  it("should complete interview via action", async () => {
    const res = await completeInterviewAction(
      {},
      {
        id: "int-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockCompleteInterview).toHaveBeenCalled();
  });

  it("should submit feedback via action", async () => {
    const res = await submitInterviewFeedbackAction(
      {},
      {
        interviewId: "int-1",
        overallRating: 4,
        recommendation: "hire",
        strengths: "Great candidate.",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockSubmitFeedback).toHaveBeenCalled();
  });
});
