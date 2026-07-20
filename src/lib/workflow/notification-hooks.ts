import { handleWorkflowNotificationEvent } from "@/lib/notifications/notification-service";
import { handleWorkflowIntegrationEvent } from "@/lib/integrations/integration-hooks";
import { processIntegrationJobs } from "@/lib/integrations/integration-worker";
import type { WorkflowNotificationEvent } from "@/lib/notifications/notification-events";

export type { WorkflowNotificationEvent } from "@/lib/notifications/notification-events";

/** Emits workflow events to notifications + Microsoft integrations. */
export async function emitWorkflowNotification(
  event: WorkflowNotificationEvent
): Promise<void> {
  try {
    await handleWorkflowNotificationEvent(event);
  } catch (err) {
    console.error("[workflow-notifications] Notification dispatch error:", err);
  }

  try {
    await handleWorkflowIntegrationEvent(event);
  } catch (err) {
    console.error("[workflow-integrations] Integration dispatch error:", err);
  }

  void processIntegrationJobs({ limit: 10 }).catch((err) => {
    console.error("[integrations] background process error:", err);
  });
}
