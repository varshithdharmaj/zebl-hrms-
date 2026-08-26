import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import type { JobRepository, JobOpeningStageView } from "@/lib/recruitment/job/types";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import {
  INSERTABLE_STAGE_POOL,
  PIPELINE_STAGE_LABELS,
  SYSTEM_STAGE_VALUES,
} from "@/lib/recruitment/shared/pipeline-stage-groups";
import type {
  CreatePipelineStageInput,
  UpdatePipelineStageInput,
  MovePipelineStageInput,
  ArchivePipelineStageInput,
} from "@/lib/validation/schemas/recruitment/pipeline-stages";

function effectiveLabel(stage: JobOpeningStageView): string {
  return stage.label ?? PIPELINE_STAGE_LABELS[stage.stage];
}

function assertNoDuplicateLabel(
  stages: readonly JobOpeningStageView[],
  label: string,
  excludeStageId?: string
): void {
  const normalized = label.trim().toLowerCase();
  const clash = stages.some(
    (s) =>
      s.id !== excludeStageId &&
      !s.isArchived &&
      effectiveLabel(s).trim().toLowerCase() === normalized
  );
  if (clash) {
    throw new RecruitmentDomainError(
      "REC_CONFLICT",
      `A stage named "${label}" already exists on this job opening.`
    );
  }
}

function assertNotSystemStage(stage: JobOpeningStageView, action: string): void {
  if (SYSTEM_STAGE_VALUES.has(stage.stage)) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      `"${effectiveLabel(stage)}" is a system stage and cannot be ${action}.`
    );
  }
}

export function createPipelineStageService(repository: JobRepository = prismaJobRepository) {
  return {
    /**
     * Inserts a new custom stage. `input.category` is the recruiter's choice;
     * the underlying RecruitmentPipelineStage enum slot is chosen
     * automatically from INSERTABLE_STAGE_POOL (the first value this job
     * hasn't already claimed) — stage identity is an implementation detail,
     * `label`/`category` are what recruiters and reports actually see.
     */
    async createStage(
      session: SessionUser,
      input: CreatePipelineStageInput
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);

      const job = await repository.getJob(input.jobOpeningId, { includeCompensation: false });
      if (!job || job.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      const label = input.label.trim();
      assertNoDuplicateLabel(job.stages, label);

      if (input.afterStageId && !job.stages.some((s) => s.id === input.afterStageId)) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Reference stage not found on this job.");
      }
      if (input.beforeStageId && !job.stages.some((s) => s.id === input.beforeStageId)) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Reference stage not found on this job.");
      }

      const usedStages = new Set(job.stages.map((s) => s.stage));
      const availableStage = INSERTABLE_STAGE_POOL.find((s) => !usedStages.has(s));
      if (!availableStage) {
        throw new RecruitmentDomainError(
          "REC_PRECONDITION",
          "This job opening has reached the maximum number of pipeline stages."
        );
      }

      const created = await withRecruitmentTransaction(async (tx) => {
        const result = await repository.insertJobStage(
          input.jobOpeningId,
          {
            stage: availableStage,
            category: input.category,
            label,
            afterStageId: input.afterStageId ?? null,
            beforeStageId: input.beforeStageId ?? null,
          },
          tx
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "job_opening",
            entityId: input.jobOpeningId,
            jobOpeningId: input.jobOpeningId,
            eventType: "pipeline_stage_added",
            summary: `Added pipeline stage "${label}"`,
            actorUserId: session.id,
            metadata: { stageId: result.id, category: input.category },
          },
          tx
        );

        return result;
      });

      await writeAuditLog({
        entityType: "job_opening",
        entityId: input.jobOpeningId,
        action: AUDIT_ACTIONS.RECRUITMENT_JOB_STAGE_ADDED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: `Added pipeline stage "${label}"`,
        metadata: { jobOpeningId: input.jobOpeningId, stageId: created.id, category: input.category },
      });

      return created;
    },

    async updateStage(session: SessionUser, input: UpdatePipelineStageInput): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);

      const stage = await repository.getJobStage(input.stageId);
      if (!stage) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Pipeline stage not found.");
      }
      assertNotSystemStage(stage, "renamed or recategorized");
      if (stage.isArchived) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Archived stages cannot be edited.");
      }

      const label = input.label !== undefined ? input.label.trim() : undefined;
      if (label !== undefined) {
        const siblings = await repository.listStages(stage.jobOpeningId);
        assertNoDuplicateLabel(siblings, label, stage.id);
      }

      if (label === undefined && input.category === undefined) return;

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateJobStage(input.stageId, { label, category: input.category }, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "job_opening",
            entityId: stage.jobOpeningId,
            jobOpeningId: stage.jobOpeningId,
            eventType: "pipeline_stage_updated",
            summary: `Updated pipeline stage "${effectiveLabel(stage)}"`,
            actorUserId: session.id,
            metadata: { stageId: stage.id, label, category: input.category },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "job_opening",
        entityId: stage.jobOpeningId,
        action: AUDIT_ACTIONS.RECRUITMENT_JOB_STAGE_UPDATED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: `Updated pipeline stage "${effectiveLabel(stage)}"`,
        metadata: { jobOpeningId: stage.jobOpeningId, stageId: stage.id, label, category: input.category },
      });
    },

    async moveStage(session: SessionUser, input: MovePipelineStageInput): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);

      const stage = await repository.getJobStage(input.stageId);
      if (!stage) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Pipeline stage not found.");
      }
      assertNotSystemStage(stage, "reordered");
      if (stage.isArchived) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Archived stages cannot be reordered.");
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.moveJobStage(input.stageId, input.direction, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "job_opening",
            entityId: stage.jobOpeningId,
            jobOpeningId: stage.jobOpeningId,
            eventType: "pipeline_stage_moved",
            summary: `Moved pipeline stage "${effectiveLabel(stage)}" ${input.direction}`,
            actorUserId: session.id,
            metadata: { stageId: stage.id, direction: input.direction },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "job_opening",
        entityId: stage.jobOpeningId,
        action: AUDIT_ACTIONS.RECRUITMENT_JOB_STAGE_MOVED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: `Moved pipeline stage "${effectiveLabel(stage)}" ${input.direction}`,
        metadata: { jobOpeningId: stage.jobOpeningId, stageId: stage.id, direction: input.direction },
      });
    },

    /**
     * Archives (never deletes) a stage: sets isArchived = true. Existing
     * candidates currently sitting in this stage are left completely
     * untouched (Application.currentStage/currentStageId, and every
     * ApplicationStageHistory row, are unaffected) — they simply stop
     * appearing as a board column going forward. New candidates can no
     * longer be moved into it (moveToStage's job.stages lookup excludes
     * archived rows).
     */
    async archiveStage(session: SessionUser, input: ArchivePipelineStageInput): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);

      const stage = await repository.getJobStage(input.stageId);
      if (!stage) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Pipeline stage not found.");
      }
      assertNotSystemStage(stage, "archived");
      if (stage.isArchived) return; // idempotent

      const candidatesInStage = await prisma.application.count({
        where: { currentStageId: stage.id, deletedAt: null },
      });

      await withRecruitmentTransaction(async (tx) => {
        await repository.archiveJobStage(input.stageId, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "job_opening",
            entityId: stage.jobOpeningId,
            jobOpeningId: stage.jobOpeningId,
            eventType: "pipeline_stage_archived",
            summary: `Archived pipeline stage "${effectiveLabel(stage)}"${
              candidatesInStage > 0 ? ` (${candidatesInStage} candidate(s) remain in it)` : ""
            }`,
            actorUserId: session.id,
            metadata: { stageId: stage.id, candidatesInStage },
          },
          tx
        );
      });

      await writeAuditLog({
        entityType: "job_opening",
        entityId: stage.jobOpeningId,
        action: AUDIT_ACTIONS.RECRUITMENT_JOB_STAGE_ARCHIVED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: session.employeeId,
        module: "recruitment",
        description: `Archived pipeline stage "${effectiveLabel(stage)}"`,
        metadata: { jobOpeningId: stage.jobOpeningId, stageId: stage.id, candidatesInStage },
      });
    },
  };
}

export const PipelineStageService = createPipelineStageService();
