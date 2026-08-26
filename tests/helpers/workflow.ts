import { vi } from "vitest";

/** Stub notification dispatch for workflow integration tests */
export function stubWorkflowNotifications() {
  vi.mock("@/lib/workflow/notification-hooks", () => ({
    dispatchWorkflowNotifications: vi.fn().mockResolvedValue(undefined),
    notifyLeaveSubmitted: vi.fn().mockResolvedValue(undefined),
    notifyLeaveApproved: vi.fn().mockResolvedValue(undefined),
    notifyLeaveRejected: vi.fn().mockResolvedValue(undefined),
  }));
}
