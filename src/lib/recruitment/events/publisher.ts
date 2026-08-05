import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import { listRecruitmentEventConsumers } from "@/lib/recruitment/events/registry";

/**
 * RecruitmentEventPublisher — fan-out to registered consumers only.
 * No business side effects here. Consumers own audit/notify/timeline/analytics.
 */
export async function publishRecruitmentEvent(event: RecruitmentDomainEvent): Promise<void> {
  const consumers = listRecruitmentEventConsumers();
  for (const consumer of consumers) {
    try {
      await consumer.handle(event);
    } catch (error) {
      console.error(
        `[recruitment:events] consumer "${consumer.name}" failed for ${event.type}/${event.eventId}`,
        error
      );
    }
  }
}

export const RecruitmentEventPublisher = {
  publish: publishRecruitmentEvent,
};
