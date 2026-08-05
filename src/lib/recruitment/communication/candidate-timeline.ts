import type { CommunicationRecord } from "@/lib/recruitment/repositories/communication-repository";
import type { TimelineItem } from "@/lib/recruitment/types/timeline";

export type CandidateTimelineSource =
  | "communication"
  | "interview"
  | "offer"
  | "conversion"
  | "system"
  | "other";

export type MergedCandidateTimelineItem = {
  id: string;
  occurredAt: Date;
  source: CandidateTimelineSource;
  eventType: string;
  summary: string;
  communicationId?: string;
  threadId?: string | null;
  status?: string | null;
  type?: string | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function classifyTimelineEvent(eventType: string): CandidateTimelineSource {
  const key = eventType.toLowerCase();
  if (key.includes("communication") || key.includes("email")) {
    return "communication";
  }
  if (key.includes("interview")) return "interview";
  if (key.includes("offer")) return "offer";
  if (key.includes("convert") || key.includes("employee")) return "conversion";
  if (key.includes("system") || key.includes("notification")) return "system";
  return "other";
}

function communicationSummary(record: CommunicationRecord): string {
  const subject = record.subject?.trim() || "Untitled";
  switch (record.type) {
    case "email_received":
      return `Received email: ${subject}`;
    case "email_sent":
      return record.status === "draft"
        ? `Draft email: ${subject}`
        : `Sent email: ${subject}`;
    case "interview_invitation":
    case "interview_reminder":
      return `Interview communication: ${subject}`;
    case "offer_letter":
      return `Offer communication: ${subject}`;
    case "internal_note":
      return `Internal note: ${subject}`;
    case "system_notification":
      return `System notification: ${subject}`;
    case "rejection":
      return `Rejection communication: ${subject}`;
    default:
      return subject;
  }
}

/**
 * Merge operational timeline events with communication records into one
 * chronological recruitment timeline (newest first).
 */
export function mergeCandidateRecruitmentTimeline(args: {
  timeline: readonly TimelineItem[];
  communications: readonly CommunicationRecord[];
}): MergedCandidateTimelineItem[] {
  const fromTimeline: MergedCandidateTimelineItem[] = args.timeline.map((item) => ({
    id: `timeline:${item.id}`,
    occurredAt: asDate(item.createdAt) ?? new Date(0),
    source: classifyTimelineEvent(item.eventType),
    eventType: item.eventType,
    summary: item.summary,
  }));

  const fromCommunications: MergedCandidateTimelineItem[] = args.communications.map(
    (record) => {
      const occurredAt =
        asDate(record.sentAt) ?? asDate(record.updatedAt) ?? asDate(record.createdAt) ?? new Date(0);
      return {
        id: `communication:${record.id}`,
        occurredAt,
        source: "communication",
        eventType: record.type,
        summary: communicationSummary(record),
        communicationId: record.id,
        threadId: record.threadId,
        status: record.status,
        type: record.type,
      };
    }
  );

  const seen = new Set<string>();
  const merged = [...fromTimeline, ...fromCommunications].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
  );

  const deduped: MergedCandidateTimelineItem[] = [];
  for (const item of merged) {
    // Prefer communication rows when a matching draft/sent timeline event exists nearby.
    const dedupeKey =
      item.communicationId ??
      `${item.source}:${item.eventType}:${item.summary}:${item.occurredAt.toISOString()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(item);
  }

  return deduped;
}
