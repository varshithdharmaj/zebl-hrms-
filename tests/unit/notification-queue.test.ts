import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationDeliveryStatus, NotificationType } from "@/generated/prisma/client";
import {
  markNotificationFailed,
  markNotificationProcessing,
} from "@/lib/notifications/notification-queue";

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    NOTIFICATION_FAILED: "notification.failed",
    NOTIFICATION_RETRIED: "notification.retried",
  },
  writeAuditLog: vi.fn(),
}));

const updateMany = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      updateMany: (...args: unknown[]) => updateMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

describe("notification queue state transitions", () => {
  beforeEach(() => {
    updateMany.mockReset();
    update.mockReset();
  });

  it("claims pending notification for processing", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const ok = await markNotificationProcessing("n1");
    expect(ok).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n1", status: NotificationDeliveryStatus.pending },
      })
    );
  });

  it("moves to dead-letter after max attempts", async () => {
    update.mockResolvedValue({});
    await markNotificationFailed("n2", "smtp down", 4);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n2" },
        data: expect.objectContaining({
          status: NotificationDeliveryStatus.failed,
        }),
      })
    );
  });

  it("schedules retry before max attempts", async () => {
    update.mockResolvedValue({});
    await markNotificationFailed("n3", "timeout", 1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationDeliveryStatus.pending,
          attempts: 2,
        }),
      })
    );
  });
});
