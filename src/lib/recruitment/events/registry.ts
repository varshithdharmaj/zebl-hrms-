import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import { auditEventConsumer } from "@/lib/recruitment/events/consumers/audit-consumer";
import { notificationEventConsumer } from "@/lib/recruitment/events/consumers/notification-consumer";
import { timelineEventConsumer } from "@/lib/recruitment/events/consumers/timeline-consumer";
import { analyticsEventConsumer } from "@/lib/recruitment/events/consumers/analytics-consumer";

export type RecruitmentEventConsumer = {
  name: string;
  handle: (event: RecruitmentDomainEvent) => Promise<void>;
};

const builtIns: readonly RecruitmentEventConsumer[] = [
  auditEventConsumer,
  notificationEventConsumer,
  timelineEventConsumer,
  analyticsEventConsumer,
];

const extras: RecruitmentEventConsumer[] = [];

export function registerRecruitmentEventConsumer(consumer: RecruitmentEventConsumer): void {
  if (
    builtIns.some((c) => c.name === consumer.name) ||
    extras.some((c) => c.name === consumer.name)
  ) {
    return;
  }
  extras.push(consumer);
}

export function listRecruitmentEventConsumers(): readonly RecruitmentEventConsumer[] {
  return [...builtIns, ...extras];
}
