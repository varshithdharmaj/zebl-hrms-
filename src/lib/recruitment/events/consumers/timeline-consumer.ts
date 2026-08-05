import { RecruitmentTimelineEntityType } from "@/generated/prisma/enums";
import type { RecruitmentDomainEvent } from "@/lib/recruitment/types/events";
import type { RecruitmentEventConsumer } from "@/lib/recruitment/events/registry";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";

export const timelineEventConsumer: RecruitmentEventConsumer = {
  name: "timeline",
  async handle(event) {
    const projection = toTimelineAppend(event);
    if (!projection) return;
    await RecruitmentTimelineService.append(projection);
  },
};

function toTimelineAppend(event: RecruitmentDomainEvent) {
  switch (event.type) {
    case "JobOpeningCreated":
      return {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: event.payload.jobOpeningId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: `Job opening created: ${event.payload.title}`,
        actorUserId: event.actor.userId,
        metadata: { status: event.payload.status },
      };
    case "JobOpeningUpdated":
      return {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: event.payload.jobOpeningId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: "Job opening updated",
        actorUserId: event.actor.userId,
        metadata: { changedFields: event.payload.changedFields },
      };
    case "JobOpeningStatusChanged":
      return {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: event.payload.jobOpeningId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: `Status changed from ${event.payload.fromStatus} to ${event.payload.toStatus}`,
        actorUserId: event.actor.userId,
        metadata: {
          fromStatus: event.payload.fromStatus,
          toStatus: event.payload.toStatus,
          reason: event.payload.reason,
        },
      };
    case "JobOpeningArchived":
      return {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: event.payload.jobOpeningId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: "Job opening archived",
        actorUserId: event.actor.userId,
        metadata: { previousStatus: event.payload.previousStatus },
      };
    case "HiringTeamChanged":
      return {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: event.payload.jobOpeningId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: `Hiring team member ${event.payload.operation} (${event.payload.role})`,
        actorUserId: event.actor.userId,
        metadata: {
          employeeId: event.payload.employeeId,
          role: event.payload.role,
          operation: event.payload.operation,
        },
      };
    case "ApplicationCreated":
      return {
        entityType: RecruitmentTimelineEntityType.application,
        entityId: event.payload.applicationId,
        applicationId: event.payload.applicationId,
        candidateId: event.payload.candidateId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: "Application created",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "ApplicationStageChanged":
      return {
        entityType: RecruitmentTimelineEntityType.application,
        entityId: event.payload.applicationId,
        applicationId: event.payload.applicationId,
        candidateId: event.payload.candidateId,
        jobOpeningId: event.payload.jobOpeningId,
        eventType: event.type,
        summary: `Stage changed to ${event.payload.toStage}`,
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "InterviewScheduled":
      return {
        entityType: RecruitmentTimelineEntityType.interview,
        entityId: event.payload.interviewId,
        applicationId: event.payload.applicationId,
        eventType: event.type,
        summary: "Interview scheduled",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "InterviewCompleted":
      return {
        entityType: RecruitmentTimelineEntityType.interview,
        entityId: event.payload.interviewId,
        applicationId: event.payload.applicationId,
        eventType: event.type,
        summary: "Interview completed",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "HiringDecisionSubmitted":
      return {
        entityType: RecruitmentTimelineEntityType.application,
        entityId: event.payload.applicationId,
        applicationId: event.payload.applicationId,
        eventType: event.type,
        summary: `Hiring decision: ${event.payload.outcome}`,
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "OfferReleased":
      return {
        entityType: RecruitmentTimelineEntityType.offer,
        entityId: event.payload.offerId,
        applicationId: event.payload.applicationId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: "Offer released",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateMerged":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.survivorCandidateId,
        candidateId: event.payload.survivorCandidateId,
        eventType: event.type,
        summary: "Candidate records merged",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "EmployeeConverted":
      return {
        entityType: RecruitmentTimelineEntityType.application,
        entityId: event.payload.applicationId,
        applicationId: event.payload.applicationId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: "Converted to employee",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateCreated":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.candidateId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: `Candidate created: ${event.payload.fullName}`,
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateUpdated":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.candidateId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: "Candidate updated",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateArchived":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.candidateId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: "Candidate archived",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateRestored":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.candidateId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: "Candidate restored",
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
    case "CandidateDuplicateDetected":
      return {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: event.payload.candidateId,
        candidateId: event.payload.candidateId,
        eventType: event.type,
        summary: `Potential duplicate candidate detected: ${event.payload.reason}`,
        actorUserId: event.actor.userId,
        metadata: { ...event.payload },
      };
  }
}
