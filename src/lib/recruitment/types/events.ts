import type { RecruitmentActor } from "@/lib/recruitment/types/actor";

export const RECRUITMENT_EVENT_TYPES = [
  "JobOpeningCreated",
  "JobOpeningUpdated",
  "JobOpeningStatusChanged",
  "JobOpeningArchived",
  "HiringTeamChanged",
  "ApplicationCreated",
  "ApplicationStageChanged",
  "InterviewScheduled",
  "InterviewCompleted",
  "HiringDecisionSubmitted",
  "OfferReleased",
  "CandidateMerged",
  "EmployeeConverted",
  "CandidateCreated",
  "CandidateUpdated",
  "CandidateArchived",
  "CandidateRestored",
  "CandidateDuplicateDetected",
  "CandidateDocumentUploaded",
  "CandidateDocumentUpdated",
  "CandidateDocumentDeleted",
  "OfferCreated",
  "OfferSent",
  "OfferAccepted",
  "OfferDeclined",
  "OfferWithdrawn",
  "OfferExpired",
  "OfferRevisionCreated",
  "EmployeeCreated",
  "RecruitmentClosed",
  "CommunicationDraftCreated",
  "CommunicationUpdated",
  "CommunicationSent",
  "CommunicationDeleted",
] as const;

export type RecruitmentEventType = (typeof RECRUITMENT_EVENT_TYPES)[number];

export type RecruitmentEventBase<TType extends RecruitmentEventType, TPayload> = {
  type: TType;
  eventId: string;
  occurredAt: string;
  actor: RecruitmentActor;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type JobOpeningCreatedPayload = {
  jobOpeningId: string;
  status: string;
  title: string;
};

export type JobOpeningUpdatedPayload = {
  jobOpeningId: string;
  changedFields: string[];
};

export type JobOpeningStatusChangedPayload = {
  jobOpeningId: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
};

export type JobOpeningArchivedPayload = {
  jobOpeningId: string;
  previousStatus: string;
};

export type HiringTeamChangedPayload = {
  jobOpeningId: string;
  employeeId: number;
  role: string;
  operation: "added" | "removed";
};

export type ApplicationCreatedPayload = {
  applicationId: string;
  candidateId: string;
  jobOpeningId: string;
};

export type ApplicationStageChangedPayload = {
  applicationId: string;
  candidateId: string;
  jobOpeningId: string;
  fromStage: string | null;
  toStage: string;
  isOverride: boolean;
};

export type InterviewScheduledPayload = {
  interviewId: string;
  applicationId: string;
  scheduledStart: string | null;
  panelistEmployeeIds: number[];
};

export type InterviewCompletedPayload = {
  interviewId: string;
  applicationId: string;
};

export type HiringDecisionSubmittedPayload = {
  decisionId: string;
  applicationId: string;
  outcome: string;
  version: number;
};

export type OfferReleasedPayload = {
  offerId: string;
  applicationId: string;
  candidateId: string;
};

export type CandidateMergedPayload = {
  survivorCandidateId: string;
  loserCandidateId: string;
};

export type EmployeeConvertedPayload = {
  snapshotId: string;
  applicationId: string;
  candidateId: string;
  offerId: string;
  employeeId: number;
};

export type CandidateCreatedPayload = {
  candidateId: string;
  fullName: string;
  source: string;
  status: string;
};

export type CandidateUpdatedPayload = {
  candidateId: string;
  changedFields: string[];
};

export type CandidateArchivedPayload = {
  candidateId: string;
  previousStatus: string;
};

export type CandidateRestoredPayload = {
  candidateId: string;
  status: string;
};

export type CandidateDuplicateDetectedPayload = {
  candidateId: string;
  duplicateCandidateId: string;
  matchingField: string;
  reason: string;
};

export type CandidateDocumentUploadedPayload = {
  candidateId: string;
  documentId: string;
  fileName: string;
};

export type CandidateDocumentUpdatedPayload = {
  candidateId: string;
  documentId: string;
  patch: Record<string, any>;
};

export type CandidateDocumentDeletedPayload = {
  candidateId: string;
  documentId: string;
};

export type JobOpeningCreatedEvent = RecruitmentEventBase<
  "JobOpeningCreated",
  JobOpeningCreatedPayload
>;
export type JobOpeningUpdatedEvent = RecruitmentEventBase<
  "JobOpeningUpdated",
  JobOpeningUpdatedPayload
>;
export type JobOpeningStatusChangedEvent = RecruitmentEventBase<
  "JobOpeningStatusChanged",
  JobOpeningStatusChangedPayload
>;
export type JobOpeningArchivedEvent = RecruitmentEventBase<
  "JobOpeningArchived",
  JobOpeningArchivedPayload
>;
export type HiringTeamChangedEvent = RecruitmentEventBase<
  "HiringTeamChanged",
  HiringTeamChangedPayload
>;
export type ApplicationCreatedEvent = RecruitmentEventBase<
  "ApplicationCreated",
  ApplicationCreatedPayload
>;
export type ApplicationStageChangedEvent = RecruitmentEventBase<
  "ApplicationStageChanged",
  ApplicationStageChangedPayload
>;
export type InterviewScheduledEvent = RecruitmentEventBase<
  "InterviewScheduled",
  InterviewScheduledPayload
>;
export type InterviewCompletedEvent = RecruitmentEventBase<
  "InterviewCompleted",
  InterviewCompletedPayload
>;
export type HiringDecisionSubmittedEvent = RecruitmentEventBase<
  "HiringDecisionSubmitted",
  HiringDecisionSubmittedPayload
>;
export type OfferReleasedEvent = RecruitmentEventBase<"OfferReleased", OfferReleasedPayload>;
export type CandidateMergedEvent = RecruitmentEventBase<"CandidateMerged", CandidateMergedPayload>;
export type EmployeeConvertedEvent = RecruitmentEventBase<
  "EmployeeConverted",
  EmployeeConvertedPayload
>;
export type CandidateCreatedEvent = RecruitmentEventBase<
  "CandidateCreated",
  CandidateCreatedPayload
>;
export type CandidateUpdatedEvent = RecruitmentEventBase<
  "CandidateUpdated",
  CandidateUpdatedPayload
>;
export type CandidateArchivedEvent = RecruitmentEventBase<
  "CandidateArchived",
  CandidateArchivedPayload
>;
export type CandidateRestoredEvent = RecruitmentEventBase<
  "CandidateRestored",
  CandidateRestoredPayload
>;
export type CandidateDuplicateDetectedEvent = RecruitmentEventBase<
  "CandidateDuplicateDetected",
  CandidateDuplicateDetectedPayload
>;
export type CandidateDocumentUploadedEvent = RecruitmentEventBase<
  "CandidateDocumentUploaded",
  CandidateDocumentUploadedPayload
>;
export type CandidateDocumentUpdatedEvent = RecruitmentEventBase<
  "CandidateDocumentUpdated",
  CandidateDocumentUpdatedPayload
>;
export type CandidateDocumentDeletedEvent = RecruitmentEventBase<
  "CandidateDocumentDeleted",
  CandidateDocumentDeletedPayload
>;

export type OfferCreatedPayload = {
  offerId: string;
  applicationId: string;
};

export type OfferSentPayload = {
  offerId: string;
  applicationId: string;
};

export type OfferAcceptedPayload = {
  offerId: string;
  applicationId: string;
};

export type OfferDeclinedPayload = {
  offerId: string;
  applicationId: string;
  reason: string | null;
};

export type OfferWithdrawnPayload = {
  offerId: string;
  applicationId: string;
  reason: string | null;
};

export type OfferExpiredPayload = {
  offerId: string;
  applicationId: string;
};

export type OfferRevisionCreatedPayload = {
  offerId: string;
  applicationId: string;
  version: number;
};

export type EmployeeCreatedPayload = {
  employeeId: number;
  email: string | null;
};

export type RecruitmentClosedPayload = {
  applicationId: string;
  candidateId: string;
};

export type OfferCreatedEvent = RecruitmentEventBase<"OfferCreated", OfferCreatedPayload>;
export type OfferSentEvent = RecruitmentEventBase<"OfferSent", OfferSentPayload>;
export type OfferAcceptedEvent = RecruitmentEventBase<"OfferAccepted", OfferAcceptedPayload>;
export type OfferDeclinedEvent = RecruitmentEventBase<"OfferDeclined", OfferDeclinedPayload>;
export type OfferWithdrawnEvent = RecruitmentEventBase<"OfferWithdrawn", OfferWithdrawnPayload>;
export type OfferExpiredEvent = RecruitmentEventBase<"OfferExpired", OfferExpiredPayload>;
export type OfferRevisionCreatedEvent = RecruitmentEventBase<"OfferRevisionCreated", OfferRevisionCreatedPayload>;
export type EmployeeCreatedEvent = RecruitmentEventBase<"EmployeeCreated", EmployeeCreatedPayload>;
export type RecruitmentClosedEvent = RecruitmentEventBase<"RecruitmentClosed", RecruitmentClosedPayload>;

export type CommunicationDraftCreatedPayload = {
  communicationId: string;
  candidateId: string | null;
  applicationId: string | null;
};

export type CommunicationUpdatedPayload = {
  communicationId: string;
  candidateId: string | null;
};

export type CommunicationSentPayload = {
  communicationId: string;
  candidateId: string | null;
  applicationId: string | null;
  recipientEmail: string | null;
};

export type CommunicationDeletedPayload = {
  communicationId: string;
  candidateId: string | null;
};

export type CommunicationDraftCreatedEvent = RecruitmentEventBase<
  "CommunicationDraftCreated",
  CommunicationDraftCreatedPayload
>;
export type CommunicationUpdatedEvent = RecruitmentEventBase<
  "CommunicationUpdated",
  CommunicationUpdatedPayload
>;
export type CommunicationSentEvent = RecruitmentEventBase<
  "CommunicationSent",
  CommunicationSentPayload
>;
export type CommunicationDeletedEvent = RecruitmentEventBase<
  "CommunicationDeleted",
  CommunicationDeletedPayload
>;

export type RecruitmentDomainEvent =
  | JobOpeningCreatedEvent
  | JobOpeningUpdatedEvent
  | JobOpeningStatusChangedEvent
  | JobOpeningArchivedEvent
  | HiringTeamChangedEvent
  | ApplicationCreatedEvent
  | ApplicationStageChangedEvent
  | InterviewScheduledEvent
  | InterviewCompletedEvent
  | HiringDecisionSubmittedEvent
  | OfferReleasedEvent
  | CandidateMergedEvent
  | EmployeeConvertedEvent
  | CandidateCreatedEvent
  | CandidateUpdatedEvent
  | CandidateArchivedEvent
  | CandidateRestoredEvent
  | CandidateDuplicateDetectedEvent
  | CandidateDocumentUploadedEvent
  | CandidateDocumentUpdatedEvent
  | CandidateDocumentDeletedEvent
  | OfferCreatedEvent
  | OfferSentEvent
  | OfferAcceptedEvent
  | OfferDeclinedEvent
  | OfferWithdrawnEvent
  | OfferExpiredEvent
  | OfferRevisionCreatedEvent
  | EmployeeCreatedEvent
  | RecruitmentClosedEvent
  | CommunicationDraftCreatedEvent
  | CommunicationUpdatedEvent
  | CommunicationSentEvent
  | CommunicationDeletedEvent;
