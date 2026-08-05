import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import { publishRecruitmentEvent } from "@/lib/recruitment/events/publisher";

/**
 * Publish domain events only after a successful commit.
 * Callers must invoke this outside the Prisma transaction.
 */
export async function publishAfterCommit(
  events: readonly RecruitmentDomainEvent[]
): Promise<void> {
  for (const event of events) {
    await publishRecruitmentEvent(event);
  }
}

/**
 * Collect events during a unit of work, then flush after commit.
 */
export function createAfterCommitBuffer() {
  const buffer: RecruitmentDomainEvent[] = [];
  return {
    enqueue(event: RecruitmentDomainEvent): void {
      buffer.push(event);
    },
    async flush(): Promise<void> {
      const copy = [...buffer];
      buffer.length = 0;
      await publishAfterCommit(copy);
    },
    get size(): number {
      return buffer.length;
    },
  };
}
