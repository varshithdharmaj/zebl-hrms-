import { enqueueIntegrationJob } from "@/lib/integrations/integration-queue";

export async function queueCalendarSync(
  leaveRequestId: number,
  operation: "create" | "delete"
): Promise<void> {
  await enqueueIntegrationJob({
    jobType: operation === "delete" ? "calendar_delete" : "calendar_sync",
    payload: { leaveRequestId },
    correlationId: `leave-${leaveRequestId}-calendar-${operation}`,
  });
}
