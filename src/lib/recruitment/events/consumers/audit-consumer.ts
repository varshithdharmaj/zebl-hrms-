import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";
import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import type { RecruitmentEventConsumer } from "@/lib/recruitment/events/registry";
import { eventIdempotencyKey } from "@/lib/recruitment/shared/idempotency";

const ACTION_BY_TYPE: Record<RecruitmentDomainEvent["type"], AuditAction> = {
  JobOpeningCreated: AUDIT_ACTIONS.RECRUITMENT_JOB_CREATED,
  JobOpeningUpdated: AUDIT_ACTIONS.RECRUITMENT_JOB_UPDATED,
  JobOpeningStatusChanged: AUDIT_ACTIONS.RECRUITMENT_JOB_STATUS_CHANGED,
  JobOpeningArchived: AUDIT_ACTIONS.RECRUITMENT_JOB_ARCHIVED,
  HiringTeamChanged: AUDIT_ACTIONS.RECRUITMENT_JOB_TEAM_CHANGED,
  ApplicationCreated: AUDIT_ACTIONS.RECRUITMENT_APPLICATION_CREATED,
  ApplicationStageChanged: AUDIT_ACTIONS.RECRUITMENT_STAGE_MOVED,
  InterviewScheduled: AUDIT_ACTIONS.RECRUITMENT_INTERVIEW_SCHEDULED,
  InterviewCompleted: AUDIT_ACTIONS.RECRUITMENT_INTERVIEW_COMPLETED,
  HiringDecisionSubmitted: AUDIT_ACTIONS.RECRUITMENT_DECISION_SUBMITTED,
  OfferReleased: AUDIT_ACTIONS.RECRUITMENT_OFFER_RELEASED,
  CandidateMerged: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_MERGED,
  EmployeeConverted: AUDIT_ACTIONS.RECRUITMENT_CONVERSION_COMPLETED,
  CandidateCreated: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_CREATED,
  CandidateUpdated: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_UPDATED,
  CandidateArchived: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_ARCHIVED,
  CandidateRestored: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_RESTORED,
  CandidateDuplicateDetected: AUDIT_ACTIONS.RECRUITMENT_CANDIDATE_DUPLICATE_DETECTED,
};

function entityRef(event: RecruitmentDomainEvent): { entityType: string; entityId: string } {
  switch (event.type) {
    case "JobOpeningCreated":
    case "JobOpeningUpdated":
    case "JobOpeningStatusChanged":
    case "JobOpeningArchived":
    case "HiringTeamChanged":
      return { entityType: "job_opening", entityId: event.payload.jobOpeningId };
    case "ApplicationCreated":
    case "ApplicationStageChanged":
      return { entityType: "application", entityId: event.payload.applicationId };
    case "InterviewScheduled":
    case "InterviewCompleted":
      return { entityType: "interview", entityId: event.payload.interviewId };
    case "HiringDecisionSubmitted":
      return { entityType: "hiring_decision", entityId: event.payload.decisionId };
    case "OfferReleased":
      return { entityType: "offer", entityId: event.payload.offerId };
    case "CandidateMerged":
      return { entityType: "candidate", entityId: event.payload.survivorCandidateId };
    case "EmployeeConverted":
      return { entityType: "conversion_snapshot", entityId: event.payload.snapshotId };
    case "CandidateCreated":
    case "CandidateUpdated":
    case "CandidateArchived":
    case "CandidateRestored":
    case "CandidateDuplicateDetected":
      return { entityType: "candidate", entityId: event.payload.candidateId };
  }
}

export const auditEventConsumer: RecruitmentEventConsumer = {
  name: "audit",
  async handle(event) {
    const { entityType, entityId } = entityRef(event);
    const idempotencyKey = eventIdempotencyKey(event.type, entityId, event.eventId);
    await writeAuditLog({
      entityType,
      entityId,
      action: ACTION_BY_TYPE[event.type],
      actorUserId: event.actor.userId,
      actorEmail: event.actor.email,
      employeeId: event.actor.employeeId,
      module: "recruitment",
      description: event.type,
      metadata: {
        eventId: event.eventId,
        idempotencyKey,
        correlationId: event.correlationId,
        payload: event.payload,
      },
    });
  },
};
