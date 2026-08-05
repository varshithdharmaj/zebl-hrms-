import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationType } from "@/generated/prisma/enums";

const enqueueNotification = vi.fn();
const createTokensForCurrentStep = vi.fn();
const resolveCurrentStepApprover = vi.fn();
const resolveManagerForEmployee = vi.fn();
const getHrRecipients = vi.fn();
const getEmployeeUserEmail = vi.fn();
const shouldSendToUser = vi.fn(async () => true);
const processNotificationQueue = vi.fn(async () => undefined);
const isTeamsIntegrationEnabled = vi.fn(async () => false);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findUnique: vi.fn(async () => ({
        id: 7,
        employeeId: 1,
        leaveType: "CL",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-01"),
        days: 1,
        reason: "Test",
        workflowStatus: "pending_approval",
        rejectionReason: null,
        employee: { name: "Ada", employeeCode: "E1" },
      })),
    },
  },
}));

vi.mock("@/lib/notifications/notification-queue", () => ({
  enqueueNotification: (...args: unknown[]) => enqueueNotification(...args),
  shouldSendToUser: (...args: unknown[]) => shouldSendToUser(...args),
}));

vi.mock("@/lib/notifications/recipient-resolver", () => ({
  resolveCurrentStepApprover: (...args: unknown[]) => resolveCurrentStepApprover(...args),
  resolveManagerForEmployee: (...args: unknown[]) => resolveManagerForEmployee(...args),
  getHrRecipients: (...args: unknown[]) => getHrRecipients(...args),
  getEmployeeUserEmail: (...args: unknown[]) => getEmployeeUserEmail(...args),
  shouldNotifyHrOnSubmit: () => false,
}));

vi.mock("@/lib/approval-tokens/token-generator", () => ({
  createTokensForCurrentStep: (...args: unknown[]) => createTokensForCurrentStep(...args),
}));

vi.mock("@/lib/notifications/worker", () => ({
  processNotificationQueue: (...args: unknown[]) => processNotificationQueue(...args),
}));

vi.mock("@/lib/integrations/integration-settings", () => ({
  getIntegrationSettings: vi.fn(),
  isTeamsIntegrationEnabled: (...args: unknown[]) => isTeamsIntegrationEnabled(...args),
  resolveTeamsWebhookUrl: vi.fn(),
}));

vi.mock("@/lib/config/app-url", () => ({
  getAppBaseUrl: () => "https://ams.example.com",
}));

import { handleWorkflowNotificationEvent } from "@/lib/notifications/notification-service";

describe("notification view URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTokensForCurrentStep.mockResolvedValue({
      approveUrl: "https://ams.example.com/approve/a",
      rejectUrl: "https://ams.example.com/approve/r",
      expiresAt: new Date("2026-08-10"),
    });
  });

  it("routes HR approval_required to admin leaves", async () => {
    resolveCurrentStepApprover.mockResolvedValue({
      email: "hr@test.local",
      userId: "hr-1",
      role: "hr",
    });

    await handleWorkflowNotificationEvent({
      leaveRequestId: 7,
      event: "approval_required",
      workflowStatus: "pending_approval",
    });

    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.approval_required,
        recipient: "hr@test.local",
        payload: expect.objectContaining({
          viewUrl: "https://ams.example.com/admin/leaves",
          approveLink: "https://ams.example.com/approve/a",
        }),
      })
    );
  });

  it("routes manager approval_required to employee approvals", async () => {
    resolveCurrentStepApprover.mockResolvedValue({
      email: "tl@test.local",
      userId: "tl-1",
      name: "Team Lead",
    });

    await handleWorkflowNotificationEvent({
      leaveRequestId: 7,
      event: "approval_required",
      workflowStatus: "pending_approval",
    });

    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "tl@test.local",
        payload: expect.objectContaining({
          viewUrl: "https://ams.example.com/employee/approvals",
        }),
      })
    );
  });

  it("generates approval tokens while handling approval_required (post-commit path)", async () => {
    resolveCurrentStepApprover.mockResolvedValue({
      email: "mgr@test.local",
      userId: "m-1",
    });

    await handleWorkflowNotificationEvent({
      leaveRequestId: 7,
      event: "approval_required",
      workflowStatus: "pending_approval",
    });

    expect(createTokensForCurrentStep).toHaveBeenCalledWith(7);
  });
});
