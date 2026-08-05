import { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import type { RecruitmentEventConsumer } from "@/lib/recruitment/events/registry";

/**
 * Maps domain events → existing notification queue.
 * Job-specific NotificationType values require a future schema migration;
 * status/team events reuse recruitment_stage_changed / recruitment_mention meantime.
 */
export const notificationEventConsumer: RecruitmentEventConsumer = {
  name: "notification",
  async handle(event) {
    const type = mapNotificationType(event);
    if (!type) return;

    const subject = subjectFor(event);
    await enqueueNotification({
      type,
      channel: NotificationChannel.email,
      recipient: event.actor.email,
      subject,
      payload: {
        eventType: event.type,
        eventId: event.eventId,
        ...event.payload,
      },
      correlationId: event.correlationId ?? event.eventId,
      userId: event.actor.userId,
    });
  },
};

function mapNotificationType(event: RecruitmentDomainEvent): NotificationType | null {
  switch (event.type) {
    case "JobOpeningStatusChanged":
      return NotificationType.recruitment_stage_changed;
    case "HiringTeamChanged":
      return NotificationType.recruitment_mention;
    case "JobOpeningCreated":
    case "JobOpeningArchived":
      return NotificationType.recruitment_mention;
    case "JobOpeningUpdated":
      return null;
    case "InterviewScheduled":
      return NotificationType.recruitment_interview_scheduled;
    case "ApplicationStageChanged":
      return NotificationType.recruitment_stage_changed;
    case "HiringDecisionSubmitted":
      return NotificationType.recruitment_decision_pending;
    case "OfferReleased":
      return NotificationType.recruitment_offer_released;
    case "CandidateMerged":
      return NotificationType.recruitment_duplicate_found;
    case "EmployeeConverted":
      return NotificationType.recruitment_converted;
    case "ApplicationCreated":
    case "InterviewCompleted":
      return null;
    case "CandidateCreated":
    case "CandidateUpdated":
    case "CandidateArchived":
    case "CandidateRestored":
      return null;
    case "CandidateDuplicateDetected":
      return NotificationType.recruitment_duplicate_found;
  }
}

function subjectFor(event: RecruitmentDomainEvent): string {
  switch (event.type) {
    case "JobOpeningCreated":
      return "Recruitment: job opening created";
    case "JobOpeningStatusChanged":
      return "Recruitment: job opening status changed";
    case "JobOpeningArchived":
      return "Recruitment: job opening archived";
    case "HiringTeamChanged":
      return "Recruitment: hiring team updated";
    case "InterviewScheduled":
      return "Recruitment: interview scheduled";
    case "ApplicationStageChanged":
      return "Recruitment: application stage changed";
    case "HiringDecisionSubmitted":
      return "Recruitment: hiring decision submitted";
    case "OfferReleased":
      return "Recruitment: offer released";
    case "CandidateMerged":
      return "Recruitment: candidates merged";
    case "EmployeeConverted":
      return "Recruitment: employee conversion completed";
    case "CandidateCreated":
      return "Recruitment: candidate created";
    case "CandidateUpdated":
      return "Recruitment: candidate updated";
    case "CandidateArchived":
      return "Recruitment: candidate archived";
    case "CandidateRestored":
      return "Recruitment: candidate restored";
    case "CandidateDuplicateDetected":
      return "Recruitment: potential duplicate candidate detected";
    default:
      return `Recruitment: ${event.type}`;
  }
}
