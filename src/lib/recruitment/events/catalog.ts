import { RECRUITMENT_EVENT_TYPES } from "@/lib/recruitment/types/events";
import type { RecruitmentEventType } from "@/lib/recruitment/types/events";

/** Static registry metadata for recruitment domain events (publisher catalog). */
export const RECRUITMENT_EVENT_CATALOG: Record<
  RecruitmentEventType,
  { description: string; aggregate: string }
> = {
  JobOpeningCreated: {
    description: "Job opening created with frozen pipeline stages",
    aggregate: "job_opening",
  },
  JobOpeningUpdated: {
    description: "Job opening fields updated",
    aggregate: "job_opening",
  },
  JobOpeningStatusChanged: {
    description: "Job opening status transitioned",
    aggregate: "job_opening",
  },
  JobOpeningArchived: {
    description: "Job opening soft-archived",
    aggregate: "job_opening",
  },
  HiringTeamChanged: {
    description: "Hiring team membership changed",
    aggregate: "job_opening",
  },
  ApplicationCreated: {
    description: "Application linked to candidate and job opening",
    aggregate: "application",
  },
  ApplicationStageChanged: {
    description: "Application pipeline stage moved",
    aggregate: "application",
  },
  InterviewScheduled: {
    description: "Interview scheduled with panel",
    aggregate: "interview",
  },
  InterviewCompleted: {
    description: "Interview marked completed",
    aggregate: "interview",
  },
  HiringDecisionSubmitted: {
    description: "Hiring decision version submitted",
    aggregate: "hiring_decision",
  },
  OfferReleased: {
    description: "Offer package released",
    aggregate: "offer",
  },
  CandidateMerged: {
    description: "Duplicate candidate merged into survivor",
    aggregate: "candidate",
  },
  EmployeeConverted: {
    description: "Candidate converted to employee",
    aggregate: "conversion_snapshot",
  },
  CandidateCreated: {
    description: "Candidate profile created",
    aggregate: "candidate",
  },
  CandidateUpdated: {
    description: "Candidate profile updated",
    aggregate: "candidate",
  },
  CandidateArchived: {
    description: "Candidate profile archived",
    aggregate: "candidate",
  },
  CandidateRestored: {
    description: "Candidate profile restored",
    aggregate: "candidate",
  },
  CandidateDuplicateDetected: {
    description: "Potential duplicate candidate detected",
    aggregate: "candidate",
  },
  CandidateDocumentUploaded: {
    description: "Candidate document uploaded",
    aggregate: "candidate_document",
  },
  CandidateDocumentUpdated: {
    description: "Candidate document updated",
    aggregate: "candidate_document",
  },
  CandidateDocumentDeleted: {
    description: "Candidate document deleted",
    aggregate: "candidate_document",
  },
  OfferCreated: {
    description: "Offer package created",
    aggregate: "offer",
  },
  OfferSent: {
    description: "Offer package sent to candidate",
    aggregate: "offer",
  },
  OfferAccepted: {
    description: "Offer package accepted by candidate",
    aggregate: "offer",
  },
  OfferDeclined: {
    description: "Offer package declined by candidate",
    aggregate: "offer",
  },
  OfferWithdrawn: {
    description: "Offer package withdrawn by employer",
    aggregate: "offer",
  },
  OfferExpired: {
    description: "Offer package expired",
    aggregate: "offer",
  },
  OfferRevisionCreated: {
    description: "Offer package revision created",
    aggregate: "offer",
  },
  EmployeeCreated: {
    description: "Employee created from candidate",
    aggregate: "employee",
  },
  RecruitmentClosed: {
    description: "Recruitment closed for candidate",
    aggregate: "application",
  },
  CommunicationDraftCreated: {
    description: "Recruitment communication draft created",
    aggregate: "communication",
  },
  CommunicationUpdated: {
    description: "Recruitment communication draft updated",
    aggregate: "communication",
  },
  CommunicationSent: {
    description: "Recruitment communication sent",
    aggregate: "communication",
  },
  CommunicationDeleted: {
    description: "Recruitment communication soft-deleted",
    aggregate: "communication",
  },
};

export function isRecruitmentEventType(value: string): value is RecruitmentEventType {
  return (RECRUITMENT_EVENT_TYPES as readonly string[]).includes(value);
}
