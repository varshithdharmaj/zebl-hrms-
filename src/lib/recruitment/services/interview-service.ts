import { prisma } from "@/lib/prisma";
import {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaInterviewRepository } from "@/lib/recruitment/repositories/prisma-interview-repository";
import type {
  InterviewDetail,
  InterviewListFilters,
  InterviewRepository,
} from "@/lib/recruitment/repositories/interview-repository";
import type { SearchFilters } from "@/lib/recruitment/types/pagination";
import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import {
  createInterviewSchema,
  updateInterviewSchema,
  submitFeedbackSchema,
} from "@/lib/validation/schemas/recruitment/interviews";

export function createInterviewService(
  repository: InterviewRepository = prismaInterviewRepository
) {
  return {
    async createInterview(
      session: SessionUser,
      input: {
        applicationId: string;
        roundType: InterviewRoundType;
        status?: InterviewStatus;
        title: string;
        scheduledStart: string;
        scheduledEnd: string;
        timezone?: string;
        location?: string;
        meetingUrl?: string;
        summary?: string;
        panelistEmployeeIds?: number[];
      }
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      // Validate input
      const parsed = createInterviewSchema.parse(input);

      // Verify application exists
      const app = await prismaApplicationRepository.getApplication(parsed.applicationId);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const events = createAfterCommitBuffer();
      const interviewId = await withRecruitmentTransaction(async (tx) => {
        const { id } = await repository.createInterview(
          {
            ...parsed,
            createdByUserId: session.id,
          },
          tx
        );

        // Timeline Event on Application
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: parsed.applicationId,
            applicationId: parsed.applicationId,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "interview_scheduled",
            summary: `Scheduled interview: ${parsed.title} (${parsed.roundType})`,
            actorUserId: session.id,
            metadata: { interviewId: id, roundType: parsed.roundType, scheduledStart: parsed.scheduledStart },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.interviewScheduled(actor, {
            interviewId: id,
            applicationId: parsed.applicationId,
            scheduledStart: parsed.scheduledStart,
            panelistEmployeeIds: parsed.panelistEmployeeIds,
          })
        );

        return id;
      });

      await events.flush();
      return { id: interviewId };
    },

    async updateInterview(
      session: SessionUser,
      input: {
        id: string;
        roundType?: InterviewRoundType;
        status?: InterviewStatus;
        title?: string;
        scheduledStart?: string;
        scheduledEnd?: string;
        timezone?: string;
        location?: string;
        meetingUrl?: string;
        summary?: string;
        panelistEmployeeIds?: number[];
      }
    ): Promise<{ applicationId: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = updateInterviewSchema.parse(input);

      const interview = await repository.getInterview(parsed.id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInterview(parsed.id, parsed, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: interview.applicationId,
            applicationId: interview.applicationId,
            candidateId: interview.application?.candidateId ?? null,
            jobOpeningId: interview.application?.jobOpeningId ?? null,
            eventType: "interview_updated",
            summary: `Updated interview: ${parsed.title ?? interview.title}`,
            actorUserId: session.id,
            metadata: {
              interviewId: parsed.id,
              scheduledStart: parsed.scheduledStart,
              scheduledEnd: parsed.scheduledEnd,
            },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "interview",
        entityId: parsed.id,
        action: AUDIT_ACTIONS.RECRUITMENT_INTERVIEW_UPDATED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: "Interview updated",
        metadata: {
          applicationId: interview.applicationId,
          title: parsed.title ?? interview.title,
        },
      });

      return { applicationId: interview.applicationId };
    },

    async cancelInterview(session: SessionUser, id: string): Promise<{ applicationId: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const interview = await repository.getInterview(id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInterview(id, { status: InterviewStatus.cancelled }, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: interview.applicationId,
            applicationId: interview.applicationId,
            candidateId: interview.application?.candidateId ?? null,
            jobOpeningId: interview.application?.jobOpeningId ?? null,
            eventType: "interview_cancelled",
            summary: `Cancelled interview: ${interview.title}`,
            actorUserId: session.id,
            metadata: { interviewId: id },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "interview",
        entityId: id,
        action: AUDIT_ACTIONS.RECRUITMENT_INTERVIEW_CANCELLED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: "Interview cancelled",
        metadata: {
          applicationId: interview.applicationId,
          title: interview.title,
        },
      });

      return { applicationId: interview.applicationId };
    },

    async completeInterview(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const interview = await repository.getInterview(id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      if (interview.status === InterviewStatus.completed) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Interview is already completed.");
      }

      if (
        interview.status === InterviewStatus.cancelled ||
        interview.status === InterviewStatus.no_show
      ) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Cannot complete a cancelled or no-show interview."
        );
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInterview(id, { status: InterviewStatus.completed }, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: interview.applicationId,
            applicationId: interview.applicationId,
            candidateId: interview.application?.candidateId ?? null,
            jobOpeningId: interview.application?.jobOpeningId ?? null,
            eventType: "interview_completed",
            summary: `Completed interview: ${interview.title}`,
            actorUserId: session.id,
            metadata: { interviewId: id },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.interviewCompleted(actor, {
            interviewId: id,
            applicationId: interview.applicationId,
          })
        );
      });

      await events.flush();
    },

    async markNoShow(session: SessionUser, id: string): Promise<{ applicationId: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const interview = await repository.getInterview(id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      if (interview.status !== InterviewStatus.scheduled) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only scheduled interviews can be marked as no-show."
        );
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInterview(id, { status: InterviewStatus.no_show }, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: interview.applicationId,
            applicationId: interview.applicationId,
            candidateId: interview.application?.candidateId ?? null,
            jobOpeningId: interview.application?.jobOpeningId ?? null,
            eventType: "interview_no_show",
            summary: `No-show for interview: ${interview.title}`,
            actorUserId: session.id,
            metadata: { interviewId: id },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "interview",
        entityId: id,
        action: AUDIT_ACTIONS.RECRUITMENT_INTERVIEW_NO_SHOW,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: "Interview marked as no-show",
        metadata: {
          applicationId: interview.applicationId,
          title: interview.title,
        },
      });

      return { applicationId: interview.applicationId };
    },

    async submitFeedback(
      session: SessionUser,
      input: {
        interviewId: string;
        overallRating: number;
        recommendation: string;
        strengths: string;
        concerns?: string;
        privateNotes?: string;
        ratingsJson?: Record<string, number>;
      }
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();

      const parsed = submitFeedbackSchema.parse(input);

      const interview = await repository.getInterview(parsed.interviewId);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      if (interview.status === InterviewStatus.cancelled) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Cannot submit feedback for a cancelled interview.");
      }

      // Check if user is a panelist or HR/Super Admin
      const isPanelist = interview.panelists.some(
        (p) => p.employee.user?.id === session.id
      );
      const isHrOrAdmin = canAccessRecruitmentAdministration(session);

      if (!isPanelist && !isHrOrAdmin) {
        throw new RecruitmentDomainError("REC_UNAUTHORIZED", "You are not authorized to submit feedback for this interview.");
      }

      // Find employee ID of the author
      const employee = await txPrismaEmployee(session.id);
      if (!employee) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Employee profile not found for current user.");
      }

      const events = createAfterCommitBuffer();
      const feedbackId = await withRecruitmentTransaction(async (tx) => {
        const { id } = await repository.submitFeedback(
          parsed.interviewId,
          employee.id,
          parsed,
          tx
        );

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: interview.applicationId,
            applicationId: interview.applicationId,
            candidateId: interview.application?.candidateId ?? null,
            jobOpeningId: interview.application?.jobOpeningId ?? null,
            eventType: "interview_feedback_submitted",
            summary: `Feedback submitted for interview: ${interview.title}`,
            actorUserId: session.id,
            metadata: { interviewId: parsed.interviewId, feedbackId: id, rating: parsed.overallRating },
          },
          tx
        );

        return id;
      });

      return { id: feedbackId };
    },

    async archiveInterview(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const interview = await repository.getInterview(id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.archiveInterview(id, tx);
      });
    },

    async restoreInterview(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const interview = await repository.getInterview(id);
      if (!interview) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Interview not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.restoreInterview(id, tx);
      });
    },

    async getInterview(session: SessionUser, id: string): Promise<InterviewDetail | null> {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);
      const interview = await repository.getInterview(id);
      if (!interview) return null;
      RecruitmentScopeEngine.assertApplicationInScope(scope, interview.applicationId);
      return interview;
    },

    async listInterviews(
      session: SessionUser,
      args: {
        filters?: InterviewListFilters | SearchFilters;
        pagination: { page: number; pageSize: number };
        sort?: { field: string; direction: "asc" | "desc" };
      }
    ) {
      const scope = await RecruitmentScopeEngine.getScope(session);
      return repository.listInterviews({
        scope,
        filters: args.filters,
        pagination: args.pagination,
        sort: args.sort,
      });
    },

    async getDashboardMetrics(
      session: SessionUser,
      filters?: InterviewListFilters | SearchFilters
    ): Promise<Record<string, unknown>> {
      const scope = await RecruitmentScopeEngine.getScope(session);
      const counts = await repository.countInterviews(
        scope,
        filters as InterviewListFilters | undefined
      );

      // Upcoming and today's interviews count
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayInterviews = await prisma.interview.count({
        where: {
          deletedAt: null,
          scheduledStart: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      const upcomingInterviews = await prisma.interview.count({
        where: {
          deletedAt: null,
          scheduledStart: {
            gt: new Date(),
          },
        },
      });

      return {
        counts,
        todayInterviews,
        upcomingInterviews,
      };
    },
  };
}

async function txPrismaEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { user: { id: userId } },
    select: { id: true },
  });
}
