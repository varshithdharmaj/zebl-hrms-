import type { Prisma } from "@/generated/prisma/client";
import {
  ApplicationPriority,
  ApplicationStatus,
  CandidateSource,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import type {
  ApplicationDetail,
  ApplicationListFilters,
  ApplicationRepository,
} from "@/lib/recruitment/repositories/application-repository";
import type { SearchFilters } from "@/lib/recruitment/types/pagination";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { PermissionError } from "@/lib/permissions";
import {
  createApplicationSchema,
  updateApplicationSchema,
  moveStageSchema,
  rejectApplicationSchema,
  withdrawApplicationSchema,
  updateApplicationAssessmentSchema,
  type UpdateApplicationAssessmentInput,
} from "@/lib/validation/schemas/recruitment/applications";

export type AfterCommitBuffer = ReturnType<typeof createAfterCommitBuffer>;

/** Minimal shape createApplicationCore needs from a job — matches JobOpeningDetail. */
export type ApplicationCoreJob = {
  title: string;
  stages: readonly { stage: RecruitmentPipelineStage; sortOrder: number }[];
};

export type CreateApplicationCoreInput = {
  candidateId: string;
  jobOpeningId: string;
  job: ApplicationCoreJob;
  assignedRecruiterUserId?: string | null;
  assignedManagerEmployeeId?: number | null;
  priority?: ApplicationPriority;
  source: CandidateSource | null;
  /** Null for anonymous public submissions — ApplicationStageHistory.actorUserId is nullable. */
  createdByUserId: string | null;
  actor: RecruitmentActor;
  /** Overrides the default "Applied for job: {title}" timeline summary. */
  summary?: string;
};

/**
 * Shared pipeline-initialization core — the ONE place stage resolution +
 * Application row + initial ApplicationStageHistory + timeline event + domain
 * event happen. Used by both the internal, session-gated createApplication()
 * below and the public /apply submit flow (public-application-service.ts),
 * so a publicly-sourced application enters the pipeline exactly where an
 * internally-created one would for the same job. See Phase-3 design §11 —
 * "don't duplicate pipeline creation logic."
 *
 * Caller owns the transaction (`tx`) and the after-commit event buffer
 * (`events`) — this function only appends to them.
 */
export async function createApplicationCore(
  repository: ApplicationRepository,
  tx: Prisma.TransactionClient,
  events: AfterCommitBuffer,
  input: CreateApplicationCoreInput
): Promise<{ id: string; initialStage: RecruitmentPipelineStage }> {
  let initialStage: RecruitmentPipelineStage = RecruitmentPipelineStage.resume_received;
  if (input.job.stages && input.job.stages.length > 0) {
    const sortedStages = [...input.job.stages].sort((a, b) => a.sortOrder - b.sortOrder);
    if (sortedStages[0]) {
      initialStage = sortedStages[0].stage;
    }
  }

  const { id } = await repository.createApplication(
    {
      candidateId: input.candidateId,
      jobOpeningId: input.jobOpeningId,
      assignedRecruiterUserId: input.assignedRecruiterUserId ?? null,
      assignedManagerEmployeeId: input.assignedManagerEmployeeId ?? null,
      priority: input.priority,
      source: input.source,
      currentStage: initialStage,
      status: ApplicationStatus.active,
      stageEnteredAt: new Date(),
      createdByUserId: input.createdByUserId,
    },
    tx
  );

  await tx.applicationStageHistory.create({
    data: {
      applicationId: id,
      fromStage: null,
      toStage: initialStage,
      actorUserId: input.createdByUserId,
    },
  });

  await RecruitmentTimelineService.append(
    {
      entityType: "application",
      entityId: id,
      applicationId: id,
      candidateId: input.candidateId,
      jobOpeningId: input.jobOpeningId,
      eventType: "application_created",
      summary: input.summary ?? `Applied for job: ${input.job.title}`,
      actorUserId: input.createdByUserId,
      metadata: { initialStage },
    },
    tx
  );

  events.enqueue(
    RecruitmentEventFactory.applicationCreated(input.actor, {
      applicationId: id,
      candidateId: input.candidateId,
      jobOpeningId: input.jobOpeningId,
    })
  );

  return { id, initialStage };
}

export function createApplicationService(
  repository: ApplicationRepository = prismaApplicationRepository
) {
  return {
    async createApplication(
      session: SessionUser,
      input: {
        candidateId: string;
        jobOpeningId: string;
        assignedRecruiterUserId?: string | null;
        assignedManagerEmployeeId?: number | null;
        priority?: ApplicationPriority;
        source?: CandidateSource | null;
      }
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      // Validate input
      const parsed = createApplicationSchema.parse(input);

      // Rule: Candidate cannot apply twice to same job unless previous application withdrawn/rejected.
      const activeApp = await repository.findActiveByCandidateAndJob(
        parsed.candidateId,
        parsed.jobOpeningId
      );
      if (activeApp) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "An active application already exists for this candidate and job opening."
        );
      }

      // Fetch Job Opening to copy stages and get first stage
      const job = await prismaJobRepository.getJob(parsed.jobOpeningId);
      if (!job) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      const events = createAfterCommitBuffer();
      const { id: applicationId } = await withRecruitmentTransaction(async (tx) => {
        return createApplicationCore(repository, tx, events, {
          candidateId: parsed.candidateId,
          jobOpeningId: parsed.jobOpeningId,
          job,
          assignedRecruiterUserId: parsed.assignedRecruiterUserId,
          assignedManagerEmployeeId: parsed.assignedManagerEmployeeId,
          priority: parsed.priority,
          source: parsed.source ?? null,
          createdByUserId: session.id,
          actor,
        });
      });

      await events.flush();
      return { id: applicationId };
    },

    async updateApplication(
      session: SessionUser,
      input: {
        id: string;
        assignedRecruiterUserId?: string | null;
        assignedManagerEmployeeId?: number | null;
        priority?: ApplicationPriority;
        source?: CandidateSource | null;
      }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsed = updateApplicationSchema.parse(input);

      const app = await repository.getApplication(parsed.id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateApplication(parsed.id, parsed, tx);
      });
    },

    async moveToStage(
      session: SessionUser,
      input: { id: string; stage: RecruitmentPipelineStage; note?: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = moveStageSchema.parse(input);

      const app = await repository.getApplication(parsed.id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      if (app.status !== ApplicationStatus.active && app.status !== ApplicationStatus.on_hold) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Cannot move stage of an inactive application. Reopen it first."
        );
      }

      if (parsed.stage === RecruitmentPipelineStage.hired) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Candidates become Hired only after Employee Conversion. Accept an offer, then Convert to Employee."
        );
      }

      // Fetch Job Opening stages to validate stage exists
      const job = await prismaJobRepository.getJob(app.jobOpeningId);
      if (!job) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      const terminalStages: RecruitmentPipelineStage[] = [
        RecruitmentPipelineStage.rejected,
        RecruitmentPipelineStage.withdrawn,
      ];
      const isTerminal = terminalStages.includes(parsed.stage);

      if (!isTerminal && job.stages && job.stages.length > 0) {
        const hasStage = job.stages.some((s) => s.stage === parsed.stage);
        if (!hasStage) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            `Stage ${parsed.stage} is not enabled for this job opening.`
          );
        }
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        const fromStage = app.currentStage;
        await repository.moveApplicationStage(parsed.id, parsed.stage, new Date(), undefined, tx);

        // Record stage history with actor
        await tx.applicationStageHistory.create({
          data: {
            applicationId: parsed.id,
            fromStage,
            toStage: parsed.stage,
            note: parsed.note ?? null,
            actorUserId: session.id,
          },
        });

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: parsed.id,
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_stage_moved",
            summary: `Moved stage from ${fromStage} to ${parsed.stage}`,
            actorUserId: session.id,
            metadata: { fromStage, toStage: parsed.stage, note: parsed.note },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.applicationStageChanged(actor, {
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            fromStage,
            toStage: parsed.stage,
            isOverride: false,
          })
        );
      });

      await events.flush();
    },

    async rejectApplication(
      session: SessionUser,
      input: { id: string; reason: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = rejectApplicationSchema.parse(input);

      const app = await repository.getApplication(parsed.id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        const fromStage = app.currentStage;
        await repository.updateApplication(
          parsed.id,
          {
            status: ApplicationStatus.rejected,
            currentStage: RecruitmentPipelineStage.rejected,
            stageEnteredAt: new Date(),
            rejectedReason: parsed.reason,
          },
          tx
        );

        await tx.applicationStageHistory.create({
          data: {
            applicationId: parsed.id,
            fromStage,
            toStage: RecruitmentPipelineStage.rejected,
            note: `Rejected: ${parsed.reason}`,
            actorUserId: session.id,
          },
        });

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: parsed.id,
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_rejected",
            summary: `Application rejected: ${parsed.reason}`,
            actorUserId: session.id,
            metadata: { reason: parsed.reason },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.applicationStageChanged(actor, {
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            fromStage,
            toStage: RecruitmentPipelineStage.rejected,
            isOverride: true,
          })
        );
      });

      await events.flush();
    },

    async withdrawApplication(
      session: SessionUser,
      input: { id: string; reason: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = withdrawApplicationSchema.parse(input);

      const app = await repository.getApplication(parsed.id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        const fromStage = app.currentStage;
        await repository.updateApplication(
          parsed.id,
          {
            status: ApplicationStatus.withdrawn,
            currentStage: RecruitmentPipelineStage.withdrawn,
            stageEnteredAt: new Date(),
            withdrawnReason: parsed.reason,
          },
          tx
        );

        await tx.applicationStageHistory.create({
          data: {
            applicationId: parsed.id,
            fromStage,
            toStage: RecruitmentPipelineStage.withdrawn,
            note: `Withdrawn: ${parsed.reason}`,
            actorUserId: session.id,
          },
        });

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: parsed.id,
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_withdrawn",
            summary: `Application withdrawn: ${parsed.reason}`,
            actorUserId: session.id,
            metadata: { reason: parsed.reason },
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.applicationStageChanged(actor, {
            applicationId: parsed.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            fromStage,
            toStage: RecruitmentPipelineStage.withdrawn,
            isOverride: true,
          })
        );
      });

      await events.flush();
    },

    async reopenApplication(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const app = await repository.getApplication(id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      // Fetch Job Opening stages to find first stage to return to
      const job = await prismaJobRepository.getJob(app.jobOpeningId);
      if (!job) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      let targetStage: RecruitmentPipelineStage = RecruitmentPipelineStage.resume_received;
      if (job.stages && job.stages.length > 0) {
        const sortedStages = [...job.stages].sort((a, b) => a.sortOrder - b.sortOrder);
        if (sortedStages[0]) {
          targetStage = sortedStages[0].stage;
        }
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        const fromStage = app.currentStage;
        await repository.updateApplication(
          id,
          {
            status: ApplicationStatus.active,
            currentStage: targetStage,
            stageEnteredAt: new Date(),
            rejectedReason: null,
            withdrawnReason: null,
          },
          tx
        );

        await tx.applicationStageHistory.create({
          data: {
            applicationId: id,
            fromStage,
            toStage: targetStage,
            note: "Application reopened",
            actorUserId: session.id,
          },
        });

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: id,
            applicationId: id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_reopened",
            summary: "Application reopened",
            actorUserId: session.id,
          },
          tx
        );

        // Publish event
        events.enqueue(
          RecruitmentEventFactory.applicationStageChanged(actor, {
            applicationId: id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            fromStage,
            toStage: targetStage,
            isOverride: true,
          })
        );
      });

      await events.flush();
    },

    /**
     * @deprecated Manual hire is removed. Hired state is owned by Employee Conversion only.
     * Kept so callers receive a clear domain error instead of silently succeeding.
     */
    async hireCandidate(_session: SessionUser, _id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      throw new RecruitmentDomainError(
        "REC_VALIDATION",
        "Hiring is only allowed through Employee Conversion after an offer is accepted."
      );
    },

    async archiveApplication(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const app = await repository.getApplication(id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.archiveApplication(id, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: id,
            applicationId: id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_archived",
            summary: "Application archived",
            actorUserId: session.id,
          },
          tx
        );
      });
    },

    async restoreApplication(session: SessionUser, id: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const app = await repository.getApplication(id);
      if (!app) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.restoreApplication(id, tx);

        // Timeline Event
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: id,
            applicationId: id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: "application_restored",
            summary: "Application restored",
            actorUserId: session.id,
          },
          tx
        );
      });
    },

    async getApplication(session: SessionUser, id: string): Promise<ApplicationDetail | null> {
      const scope = await RecruitmentScopeEngine.getScope(session);
      RecruitmentScopeEngine.assertApplicationInScope(scope, id);

      return repository.getApplication(id);
    },

    async updateApplicationAssessment(
      session: SessionUser,
      input: UpdateApplicationAssessmentInput
    ): Promise<ApplicationDetail> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageApplications(session);
      const actor = toRecruitmentActor(session);

      const parsed = updateApplicationAssessmentSchema.parse(input);

      const allowed = await RecruitmentScopeEngine.canManageApplication(
        actor,
        parsed.applicationId
      );
      if (!allowed) {
        throw new PermissionError("Application outside recruitment scope.");
      }

      const existing = await repository.getApplication(parsed.applicationId);
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const now = new Date();
      const cleared = parsed.assessment == null;

      const updated = await withRecruitmentTransaction(async (tx) => {
        return repository.updateAssessment(
          parsed.applicationId,
          {
            assessment: parsed.assessment,
            assessmentUpdatedAt: now,
            assessmentUpdatedByUserId: session.id,
          },
          tx
        );
      });

      await RecruitmentTimelineService.append({
        entityType: "application",
        entityId: parsed.applicationId,
        applicationId: parsed.applicationId,
        candidateId: existing.candidateId,
        jobOpeningId: existing.jobOpeningId,
        eventType: "ApplicationAssessmentUpdated",
        summary: cleared
          ? "Recruiter assessment cleared"
          : "Application assessment updated",
        actorUserId: session.id,
        metadata: {
          cleared,
          // Intentionally omit assessment body
        },
      });

      await writeAuditLog({
        entityType: "application",
        entityId: parsed.applicationId,
        action: AUDIT_ACTIONS.RECRUITMENT_APPLICATION_ASSESSMENT_UPDATED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: cleared
          ? "Recruiter assessment cleared"
          : "Recruiter assessment updated",
        metadata: {
          candidateId: existing.candidateId,
          jobOpeningId: existing.jobOpeningId,
          cleared,
        },
      });

      return updated;
    },

    async listApplications(
      session: SessionUser,
      args: {
        filters?: ApplicationListFilters | SearchFilters;
        pagination: { page: number; pageSize: number };
        sort?: { field: string; direction: "asc" | "desc" };
      }
    ) {
      const scope = await RecruitmentScopeEngine.getScope(session);
      return repository.listApplications({
        scope,
        filters: args.filters,
        pagination: args.pagination,
        sort: args.sort,
      });
    },

    async countCandidateApplications(
      session: SessionUser,
      candidateId: string
    ): Promise<number> {
      const scope = await RecruitmentScopeEngine.getScope(session);
      return repository.countByCandidate(scope, candidateId);
    },

    async getDashboardMetrics(
      session: SessionUser,
      filters?: ApplicationListFilters | SearchFilters
    ): Promise<Record<string, unknown>> {
      const scope = await RecruitmentScopeEngine.getScope(session);
      const counts = await repository.countApplications(
        scope,
        filters as ApplicationListFilters | undefined
      );

      // Average time in stage (mock/calculated from stage history)
      // In production, we'd query the average duration from StageHistory.
      // Since this is a production-grade ATS, let's calculate actual average time in stage!
      const jobOpeningId =
        typeof filters?.jobOpeningId === "string" ? filters.jobOpeningId : undefined;
      const history = await prisma.applicationStageHistory.findMany({
        where: {
          application: {
            deletedAt: null,
            jobOpeningId,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const stageDurations: Record<string, { totalMs: number; count: number }> = {};
      const lastTransition: Record<string, Date> = {};

      history.forEach((h) => {
        const appKey = h.applicationId;
        const prevDate = lastTransition[appKey];
        if (prevDate && h.fromStage) {
          const duration = h.createdAt.getTime() - prevDate.getTime();
          if (!stageDurations[h.fromStage]) {
            stageDurations[h.fromStage] = { totalMs: 0, count: 0 };
          }
          stageDurations[h.fromStage].totalMs += duration;
          stageDurations[h.fromStage].count += 1;
        }
        lastTransition[appKey] = h.createdAt;
      });

      const averageTimeInStage: Record<string, number> = {};
      Object.entries(stageDurations).forEach(([stage, data]) => {
        const avgDays = data.totalMs / (1000 * 60 * 60 * 24) / data.count;
        averageTimeInStage[stage] = parseFloat(avgDays.toFixed(1));
      });

      return {
        counts,
        averageTimeInStage,
      };
    },
  };
}
