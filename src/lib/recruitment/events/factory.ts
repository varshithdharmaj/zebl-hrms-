import { randomUUID } from "node:crypto";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";
import type {
  RecruitmentDomainEvent,
  RecruitmentEventType,
  JobOpeningCreatedPayload,
  JobOpeningUpdatedPayload,
  JobOpeningStatusChangedPayload,
  JobOpeningArchivedPayload,
  HiringTeamChangedPayload,
  ApplicationCreatedPayload,
  ApplicationStageChangedPayload,
  InterviewScheduledPayload,
  InterviewCompletedPayload,
  HiringDecisionSubmittedPayload,
  OfferReleasedPayload,
  CandidateMergedPayload,
  EmployeeConvertedPayload,
  CandidateCreatedPayload,
  CandidateUpdatedPayload,
  CandidateArchivedPayload,
  CandidateRestoredPayload,
  CandidateDuplicateDetectedPayload,
  CandidateDocumentUploadedPayload,
  CandidateDocumentUpdatedPayload,
  CandidateDocumentDeletedPayload,
  OfferCreatedPayload,
  OfferSentPayload,
  OfferAcceptedPayload,
  OfferDeclinedPayload,
  OfferWithdrawnPayload,
  OfferExpiredPayload,
  OfferRevisionCreatedPayload,
  EmployeeCreatedPayload,
  RecruitmentClosedPayload,
  CommunicationDraftCreatedPayload,
  CommunicationUpdatedPayload,
  CommunicationSentPayload,
  CommunicationDeletedPayload,
} from "@/lib/recruitment/types/events";

function base<TType extends RecruitmentEventType>(
  type: TType,
  actor: RecruitmentActor,
  extras?: { correlationId?: string; causationId?: string; eventId?: string }
) {
  return {
    type,
    eventId: extras?.eventId ?? randomUUID(),
    occurredAt: new Date().toISOString(),
    actor,
    correlationId: extras?.correlationId,
    causationId: extras?.causationId,
  };
}

/** Typed event factory — publisher-only construction helpers. */
export const RecruitmentEventFactory = {
  jobOpeningCreated(
    actor: RecruitmentActor,
    payload: JobOpeningCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("JobOpeningCreated", actor, extras), payload };
  },

  jobOpeningUpdated(
    actor: RecruitmentActor,
    payload: JobOpeningUpdatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("JobOpeningUpdated", actor, extras), payload };
  },

  jobOpeningStatusChanged(
    actor: RecruitmentActor,
    payload: JobOpeningStatusChangedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("JobOpeningStatusChanged", actor, extras), payload };
  },

  jobOpeningArchived(
    actor: RecruitmentActor,
    payload: JobOpeningArchivedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("JobOpeningArchived", actor, extras), payload };
  },

  hiringTeamChanged(
    actor: RecruitmentActor,
    payload: HiringTeamChangedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("HiringTeamChanged", actor, extras), payload };
  },

  applicationCreated(
    actor: RecruitmentActor,
    payload: ApplicationCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("ApplicationCreated", actor, extras), payload };
  },

  applicationStageChanged(
    actor: RecruitmentActor,
    payload: ApplicationStageChangedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("ApplicationStageChanged", actor, extras), payload };
  },

  interviewScheduled(
    actor: RecruitmentActor,
    payload: InterviewScheduledPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("InterviewScheduled", actor, extras), payload };
  },

  interviewCompleted(
    actor: RecruitmentActor,
    payload: InterviewCompletedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("InterviewCompleted", actor, extras), payload };
  },

  hiringDecisionSubmitted(
    actor: RecruitmentActor,
    payload: HiringDecisionSubmittedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("HiringDecisionSubmitted", actor, extras), payload };
  },

  offerReleased(
    actor: RecruitmentActor,
    payload: OfferReleasedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferReleased", actor, extras), payload };
  },

  candidateMerged(
    actor: RecruitmentActor,
    payload: CandidateMergedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateMerged", actor, extras), payload };
  },

  employeeConverted(
    actor: RecruitmentActor,
    payload: EmployeeConvertedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("EmployeeConverted", actor, extras), payload };
  },

  candidateCreated(
    actor: RecruitmentActor,
    payload: CandidateCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateCreated", actor, extras), payload };
  },

  candidateUpdated(
    actor: RecruitmentActor,
    payload: CandidateUpdatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateUpdated", actor, extras), payload };
  },

  candidateArchived(
    actor: RecruitmentActor,
    payload: CandidateArchivedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateArchived", actor, extras), payload };
  },

  candidateRestored(
    actor: RecruitmentActor,
    payload: CandidateRestoredPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateRestored", actor, extras), payload };
  },

  candidateDuplicateDetected(
    actor: RecruitmentActor,
    payload: CandidateDuplicateDetectedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateDuplicateDetected", actor, extras), payload };
  },

  candidateDocumentUploaded(
    actor: RecruitmentActor,
    payload: CandidateDocumentUploadedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateDocumentUploaded", actor, extras), payload };
  },

  candidateDocumentUpdated(
    actor: RecruitmentActor,
    payload: CandidateDocumentUpdatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateDocumentUpdated", actor, extras), payload };
  },

  candidateDocumentDeleted(
    actor: RecruitmentActor,
    payload: CandidateDocumentDeletedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CandidateDocumentDeleted", actor, extras), payload };
  },

  offerCreated(
    actor: RecruitmentActor,
    payload: OfferCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferCreated", actor, extras), payload };
  },

  offerSent(
    actor: RecruitmentActor,
    payload: OfferSentPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferSent", actor, extras), payload };
  },

  offerAccepted(
    actor: RecruitmentActor,
    payload: OfferAcceptedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferAccepted", actor, extras), payload };
  },

  offerDeclined(
    actor: RecruitmentActor,
    payload: OfferDeclinedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferDeclined", actor, extras), payload };
  },

  offerWithdrawn(
    actor: RecruitmentActor,
    payload: OfferWithdrawnPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferWithdrawn", actor, extras), payload };
  },

  offerExpired(
    actor: RecruitmentActor,
    payload: OfferExpiredPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferExpired", actor, extras), payload };
  },

  offerRevisionCreated(
    actor: RecruitmentActor,
    payload: OfferRevisionCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("OfferRevisionCreated", actor, extras), payload };
  },

  employeeCreated(
    actor: RecruitmentActor,
    payload: EmployeeCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("EmployeeCreated", actor, extras), payload };
  },

  recruitmentClosed(
    actor: RecruitmentActor,
    payload: RecruitmentClosedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("RecruitmentClosed", actor, extras), payload };
  },

  communicationDraftCreated(
    actor: RecruitmentActor,
    payload: CommunicationDraftCreatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CommunicationDraftCreated", actor, extras), payload };
  },

  communicationUpdated(
    actor: RecruitmentActor,
    payload: CommunicationUpdatedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CommunicationUpdated", actor, extras), payload };
  },

  communicationSent(
    actor: RecruitmentActor,
    payload: CommunicationSentPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CommunicationSent", actor, extras), payload };
  },

  communicationDeleted(
    actor: RecruitmentActor,
    payload: CommunicationDeletedPayload,
    extras?: { correlationId?: string; causationId?: string }
  ): RecruitmentDomainEvent {
    return { ...base("CommunicationDeleted", actor, extras), payload };
  },
};
