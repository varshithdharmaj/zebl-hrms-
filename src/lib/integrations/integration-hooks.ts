import type { WorkflowNotificationEvent } from "@/lib/notifications/notification-events";
import { mapWorkflowEventToNotificationEvent } from "@/lib/notifications/notification-events";
import { queueCalendarSync } from "@/lib/calendar/calendar-sync";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

export async function handleWorkflowIntegrationEvent(
  event: WorkflowNotificationEvent
): Promise<void> {
  const eventName = mapWorkflowEventToNotificationEvent(event.event);
  const settings = await getIntegrationSettings();
  if (eventName === "LEAVE_APPROVED" && settings.calendarSyncEnabled) {
    await queueCalendarSync(event.leaveRequestId, "create");
  }

  if (eventName === "LEAVE_CANCELLED" && settings.calendarSyncEnabled) {
    await queueCalendarSync(event.leaveRequestId, "delete");
  }

}
