import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import type { RecruitmentEventConsumer } from "@/lib/recruitment/events/registry";

/**
 * Analytics consumer — Phase 1 stub.
 * Later phases write RecruitmentMetricSnapshot / analytics hooks.
 */
export const analyticsEventConsumer: RecruitmentEventConsumer = {
  name: "analytics",
  async handle(event) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[recruitment:analytics] ${event.type}`, event.eventId);
    }
  },
};
