"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAdmin, PermissionError } from "@/lib/permissions";
import {
  getSessionOrThrow,
  requireAdminSession,
} from "@/lib/auth-guards";
import {
  getUserPreferences,
  resetNotificationForRetry,
} from "@/lib/notifications/notification-queue";
import { processNotificationQueue } from "@/lib/notifications/worker";

export type NotificationActionState = {
  error?: string;
  success?: string;
};

export async function retryNotificationAction(
  _prev: NotificationActionState,
  formData: FormData
): Promise<NotificationActionState> {
  try {
    await requireAdminSession();
    const id = String(formData.get("notificationId") ?? "");
    if (!id) return { error: "Invalid notification." };

    await resetNotificationForRetry(id);
    await processNotificationQueue({ limit: 10 });

    revalidatePath("/admin/notifications");
    return { success: "Notification queued for retry." };
  } catch {
    return { error: "Failed to retry notification." };
  }
}

export async function processNotificationsAction(): Promise<NotificationActionState> {
  try {
    await requireAdminSession();
    const result = await processNotificationQueue({ limit: 50 });
    revalidatePath("/admin/notifications");
    return {
      success: `Processed ${result.processed}: ${result.sent} sent, ${result.failed} failed.`,
    };
  } catch {
    return { error: "Failed to process queue." };
  }
}

export async function updateNotificationPreferencesAction(
  _prev: NotificationActionState,
  formData: FormData
): Promise<NotificationActionState> {
  try {
    const session = await getSessionOrThrow();

    await prisma.notificationPreference.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        emailEnabled: formData.get("emailEnabled") === "on",
        leaveApprovalAlerts: formData.get("leaveApprovalAlerts") === "on",
        leaveStatusAlerts: formData.get("leaveStatusAlerts") === "on",
        escalationAlerts: formData.get("escalationAlerts") === "on",
        teamsNotificationsEnabled: formData.get("teamsNotificationsEnabled") === "on",
        teamsApprovalCardsEnabled: formData.get("teamsApprovalCardsEnabled") === "on",
        calendarSyncEnabled: formData.get("calendarSyncEnabled") === "on",
        futureTeamsEnabled: formData.get("teamsNotificationsEnabled") === "on",
        futurePushEnabled: formData.get("futurePushEnabled") === "on",
      },
      update: {
        emailEnabled: formData.get("emailEnabled") === "on",
        leaveApprovalAlerts: formData.get("leaveApprovalAlerts") === "on",
        leaveStatusAlerts: formData.get("leaveStatusAlerts") === "on",
        escalationAlerts: formData.get("escalationAlerts") === "on",
        teamsNotificationsEnabled: formData.get("teamsNotificationsEnabled") === "on",
        teamsApprovalCardsEnabled: formData.get("teamsApprovalCardsEnabled") === "on",
        calendarSyncEnabled: formData.get("calendarSyncEnabled") === "on",
        futureTeamsEnabled: formData.get("teamsNotificationsEnabled") === "on",
        futurePushEnabled: formData.get("futurePushEnabled") === "on",
      },
    });

    revalidatePath("/employee/settings");
    return { success: "Notification preferences saved." };
  } catch {
    return { error: "Failed to save preferences." };
  }
}

export async function getNotificationPreferencesForUser(userId: string) {
  const session = await getSessionOrThrow();
  if (session.id !== userId && !canAccessAdmin(session.role)) {
    throw new PermissionError("Unauthorized");
  }

  return getUserPreferences(userId);
}
