import {
  HiringTeamRole,
  JobOpeningStatus,
  NoteVisibility,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { PermissionError } from "@/lib/permissions";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import type { JobRepository } from "@/lib/recruitment/job/types";
import type {
  HiringTeamMemberInput,
  JobOpeningDetail,
  JobOpeningListItem,
  JobListArgs,
  JobStatusCounts,
} from "@/lib/recruitment/job/types";
import { composeRequirements } from "@/lib/recruitment/job/requirements-skills";
import {
  assertJobStatusTransition,
  timestampsForStatus,
} from "@/lib/recruitment/job/status-transitions";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { generateUniqueJobSlug } from "@/lib/recruitment/shared/slug";
import type { CreateJobOpeningInput, UpdateJobOpeningInput } from "@/lib/validation/schemas/recruitment/jobs";
import type { PageResult } from "@/lib/recruitment/types/pagination";

async function resolvePipelineStages(templateId: string | null | undefined) {
  let resolvedTemplateId = templateId ?? null;
  if (!resolvedTemplateId) {
    const settings = await prisma.recruitmentSettings.findUnique({
      where: { id: "default" },
      select: { defaultPipelineTemplateId: true },
    });
    resolvedTemplateId = settings?.defaultPipelineTemplateId ?? null;
  }

  if (!resolvedTemplateId) {
    const fallback = await prisma.recruitmentPipelineTemplate.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    resolvedTemplateId = fallback?.id ?? null;
  }

  if (!resolvedTemplateId) {
    throw new RecruitmentDomainError(
      "REC_PRECONDITION",
      "No pipeline template is available. Seed recruitment settings first."
    );
  }

  const template = await prisma.recruitmentPipelineTemplate.findFirst({
    where: { id: resolvedTemplateId, deletedAt: null, isActive: true },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template || template.stages.length === 0) {
    throw new RecruitmentDomainError(
      "REC_PRECONDITION",
      "Selected pipeline template is missing or has no stages."
    );
  }

  return {
    templateId: template.id,
    stages: template.stages.map((s) => ({
      stage: s.stage,
      sortOrder: s.sortOrder,
      isOptional: s.isOptional,
      isEnabled: true,
      label: s.label,
      slaDays: s.slaDays,
    })),
  };
}

function buildInitialTeam(input: CreateJobOpeningInput): HiringTeamMemberInput[] {
  const team: HiringTeamMemberInput[] = [];
  const seen = new Set<string>();

  const push = (employeeId: number | null | undefined, role: HiringTeamRole) => {
    if (employeeId == null) return;
    const key = `${employeeId}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    team.push({ employeeId, role });
  };

  push(input.hiringManagerEmployeeId, HiringTeamRole.hiring_manager);
  push(input.recruiterEmployeeId, HiringTeamRole.recruiter);
  for (const id of input.teamLeadEmployeeIds ?? []) {
    push(id, HiringTeamRole.team_lead);
  }
  return team;
}

function changedFields(
  before: JobOpeningDetail,
  patch: UpdateJobOpeningInput
): string[] {
  const fields: string[] = [];
  const check = (key: string, next: unknown, prev: unknown) => {
    if (next !== undefined && String(next ?? "") !== String(prev ?? "")) {
      fields.push(key);
    }
  };
  check("title", patch.title, before.title);
  check("code", patch.code, before.code);
  check("department", patch.department, before.department);
  check("location", patch.location, before.location);
  check("workMode", patch.workMode, before.workMode);
  check("employmentType", patch.employmentType, before.employmentType);
  check("description", patch.description, before.description);
  check("openingsCount", patch.openingsCount, before.openingsCount);
  check("headcountApproved", patch.headcountApproved, before.headcountApproved);
  check("headcountUrgency", patch.headcountUrgency, before.headcountUrgency);
  check("compensationCurrency", patch.compensationCurrency, before.compensationCurrency);
  check("compensationMin", patch.compensationMin, before.compensationMin);
  check("compensationMax", patch.compensationMax, before.compensationMax);
  check("ownerRecruiterUserId", patch.ownerRecruiterUserId, before.ownerRecruiterUserId);
  if (patch.requirements !== undefined || patch.skills !== undefined) {
    fields.push("requirements");
  }
  if (patch.targetStartDate !== undefined) fields.push("targetStartDate");
  return fields;
}

export function createJobOpeningService(repository: JobRepository = prismaJobRepository) {
  return {
    async create(session: SessionUser, input: CreateJobOpeningInput): Promise<{ jobId: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);

      if (input.code) {
        const existing = await repository.findByCode(input.code);
        if (existing) {
          throw new RecruitmentDomainError("REC_CONFLICT", "Job code already exists.");
        }
      }

      const team = buildInitialTeam(input);
      if (team.filter((m) => m.role === HiringTeamRole.hiring_manager).length > 1) {
        throw new RecruitmentDomainError(
          "REC_JOB_SINGLE_HM",
          "A job opening may have at most one hiring manager."
        );
      }

      for (const member of team) {
        const employee = await prisma.employee.findFirst({
          where: { id: member.employeeId, isActive: true },
          select: { id: true },
        });
        if (!employee) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            `Employee #${member.employeeId} was not found or is inactive.`
          );
        }
      }

      const { templateId, stages } = await resolvePipelineStages(input.pipelineTemplateId);
      const requirements = composeRequirements(input.requirements, input.skills);
      const initialStatus = input.publish ? JobOpeningStatus.open : JobOpeningStatus.draft;
      if (initialStatus === JobOpeningStatus.open) {
        if (!input.title.trim() || stages.length === 0 || input.openingsCount < 1) {
          throw new RecruitmentDomainError(
            "REC_PRECONDITION",
            "Cannot publish: title, stages, and openings count are required."
          );
        }
      }

      const events = createAfterCommitBuffer();
      const jobId = await withRecruitmentTransaction(async (tx) => {
        const created = await repository.createJob(
          {
            title: input.title,
            code: input.code ?? null,
            status: initialStatus,
            department: input.department ?? null,
            location: input.location ?? null,
            workMode: input.workMode ?? null,
            employmentType: input.employmentType,
            description: input.description ?? null,
            requirements,
            openingsCount: input.openingsCount,
            headcountApproved: input.headcountApproved ?? false,
            headcountRequestedByEmployeeId: input.headcountRequestedByEmployeeId ?? null,
            headcountRequestedAt:
              input.headcountRequestedByEmployeeId != null ? new Date() : null,
            headcountUrgency: input.headcountUrgency ?? null,
            compensationCurrency: input.compensationCurrency ?? null,
            compensationMin: input.compensationMin ?? null,
            compensationMax: input.compensationMax ?? null,
            targetStartDate: input.targetStartDate ?? null,
            pipelineTemplateId: templateId,
            ownerRecruiterUserId: input.ownerRecruiterUserId ?? session.id,
            createdByUserId: session.id,
          },
          stages,
          team,
          tx
        );

        if (initialStatus === JobOpeningStatus.open) {
          await repository.changeStatus(
            created.id,
            JobOpeningStatus.open,
            timestampsForStatus(JobOpeningStatus.open),
            tx
          );
        }

        if (input.notes?.trim()) {
          await repository.addNote(
            created.id,
            {
              body: input.notes.trim(),
              visibility: NoteVisibility.hr_only,
              authorUserId: session.id,
            },
            tx
          );
        }

        events.enqueue(
          RecruitmentEventFactory.jobOpeningCreated(actor, {
            jobOpeningId: created.id,
            status: initialStatus,
            title: input.title,
          })
        );
        for (const member of team) {
          events.enqueue(
            RecruitmentEventFactory.hiringTeamChanged(actor, {
              jobOpeningId: created.id,
              employeeId: member.employeeId,
              role: member.role,
              operation: "added",
            })
          );
        }
        return created.id;
      });

      await events.flush();
      return { jobId };
    },

    async update(session: SessionUser, input: UpdateJobOpeningInput): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);

      const canViewComp = RecruitmentPermissionService.canEditJobCompensation(session);
      const existing = await repository.getJob(input.id, { includeCompensation: canViewComp });
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      if (input.code && input.code !== existing.code) {
        const clash = await repository.findByCode(input.code);
        if (clash && clash.id !== input.id) {
          throw new RecruitmentDomainError("REC_CONFLICT", "Job code already exists.");
        }
      }

      const requirements =
        input.requirements !== undefined || input.skills !== undefined
          ? composeRequirements(
              input.requirements !== undefined ? input.requirements : existing.requirements,
              input.skills !== undefined ? input.skills : existing.skillsText
            )
          : undefined;

      const patch = {
        title: input.title,
        code: input.code,
        department: input.department,
        location: input.location,
        workMode: input.workMode,
        employmentType: input.employmentType,
        description: input.description,
        requirements,
        openingsCount: input.openingsCount,
        headcountApproved: input.headcountApproved,
        headcountRequestedByEmployeeId: input.headcountRequestedByEmployeeId,
        headcountUrgency: input.headcountUrgency,
        compensationCurrency: canViewComp ? input.compensationCurrency : undefined,
        compensationMin: canViewComp ? input.compensationMin : undefined,
        compensationMax: canViewComp ? input.compensationMax : undefined,
        targetStartDate: input.targetStartDate,
        ownerRecruiterUserId: input.ownerRecruiterUserId,
      };

      const fields = changedFields(existing, input);
      if (fields.length === 0 && requirements === undefined) return;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.updateJob(input.id, patch, tx);

        // Sync hiring manager if provided
        if (input.hiringManagerEmployeeId !== undefined) {
          const currentHm = existing.hiringTeam.find(
            (m) => m.role === HiringTeamRole.hiring_manager
          );
          if (currentHm && currentHm.employeeId !== input.hiringManagerEmployeeId) {
            await repository.removeHiringTeamMember(currentHm.id, tx);
            events.enqueue(
              RecruitmentEventFactory.hiringTeamChanged(actor, {
                jobOpeningId: input.id,
                employeeId: currentHm.employeeId,
                role: HiringTeamRole.hiring_manager,
                operation: "removed",
              })
            );
          }
          if (
            input.hiringManagerEmployeeId != null &&
            (!currentHm || currentHm.employeeId !== input.hiringManagerEmployeeId)
          ) {
            await repository.addHiringTeamMember(
              input.id,
              input.hiringManagerEmployeeId,
              HiringTeamRole.hiring_manager,
              tx
            );
            events.enqueue(
              RecruitmentEventFactory.hiringTeamChanged(actor, {
                jobOpeningId: input.id,
                employeeId: input.hiringManagerEmployeeId,
                role: HiringTeamRole.hiring_manager,
                operation: "added",
              })
            );
          }
        }

        events.enqueue(
          RecruitmentEventFactory.jobOpeningUpdated(actor, {
            jobOpeningId: input.id,
            changedFields: fields.length > 0 ? fields : ["hiringTeam"],
          })
        );
      });
      await events.flush();
    },

    async archive(session: SessionUser, jobId: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);
      const existing = await repository.getJob(jobId, { includeCompensation: false });
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }
      if (existing.deletedAt) return;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.archiveJob(jobId, tx);
        events.enqueue(
          RecruitmentEventFactory.jobOpeningArchived(actor, {
            jobOpeningId: jobId,
            previousStatus: existing.status,
          })
        );
      });
      await events.flush();
    },

    async close(session: SessionUser, jobId: string, reason: string): Promise<void> {
      return this.changeStatus(session, jobId, JobOpeningStatus.closed, reason);
    },

    async reopen(
      session: SessionUser,
      jobId: string,
      toStatus: "open" | "draft" = "open"
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);
      const existing = await repository.getJob(jobId, { includeCompensation: false });
      if (!existing) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        if (existing.deletedAt) {
          const stamps = timestampsForStatus(toStatus);
          await repository.reopenJob(jobId, toStatus, stamps, tx);
          events.enqueue(
            RecruitmentEventFactory.jobOpeningStatusChanged(actor, {
              jobOpeningId: jobId,
              fromStatus: existing.status,
              toStatus,
              reason: "Reopened from archive",
            })
          );
          return;
        }

        assertJobStatusTransition(existing.status, toStatus);
        if (existing.status === toStatus) return;
        const stamps = timestampsForStatus(toStatus);
        await repository.changeStatus(jobId, toStatus, stamps, tx);
        events.enqueue(
          RecruitmentEventFactory.jobOpeningStatusChanged(actor, {
            jobOpeningId: jobId,
            fromStatus: existing.status,
            toStatus,
            reason: "Reopened",
          })
        );
      });
      await events.flush();
    },

    async changeStatus(
      session: SessionUser,
      jobId: string,
      toStatus: JobOpeningStatus,
      reason?: string | null
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);
      const existing = await repository.getJob(jobId, { includeCompensation: false });
      if (!existing || existing.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }
      if (existing.status === toStatus) return;

      assertJobStatusTransition(existing.status, toStatus);

      if (
        toStatus === JobOpeningStatus.closed &&
        existing.status !== JobOpeningStatus.draft &&
        (!reason || reason.trim().length < 2)
      ) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Closing reason is required.");
      }

      if (toStatus === JobOpeningStatus.open) {
        const stages = await repository.listStages(jobId);
        const activeStageCount = stages.filter((s) => !s.isArchived).length;
        if (!existing.title.trim() || activeStageCount === 0 || existing.openingsCount < 1) {
          throw new RecruitmentDomainError(
            "REC_PRECONDITION",
            "Cannot open job: title, stages, and openings count are required."
          );
        }
      }

      const stamps = timestampsForStatus(toStatus);
      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.changeStatus(jobId, toStatus, stamps, tx);
        events.enqueue(
          RecruitmentEventFactory.jobOpeningStatusChanged(actor, {
            jobOpeningId: jobId,
            fromStatus: existing.status,
            toStatus,
            reason: reason?.trim() || null,
          })
        );
      });
      await events.flush();
    },

    async get(session: SessionUser, jobId: string): Promise<JobOpeningDetail> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);
      const allowed = await RecruitmentScopeEngine.canViewJob(actor, jobId);
      if (!allowed) {
        throw new PermissionError("Job opening outside recruitment scope.");
      }
      const includeCompensation = RecruitmentPermissionService.canEditJobCompensation(session);
      const job = await repository.getJob(jobId, { includeCompensation });
      if (!job || (job.deletedAt && !RecruitmentPermissionService.canEditJobCompensation(session))) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }
      return job;
    },

    async list(
      session: SessionUser,
      args: Omit<JobListArgs, "scope">
    ): Promise<PageResult<JobOpeningListItem>> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);
      const scope = await RecruitmentScopeEngine.resolveScope(actor);
      return repository.listJobs({ ...args, scope });
    },

    async count(session: SessionUser): Promise<JobStatusCounts> {
      RecruitmentPermissionService.requireModuleEnabled();
      const actor = toRecruitmentActor(session);
      const scope = await RecruitmentScopeEngine.resolveScope(actor);
      return repository.countJobs(scope);
    },

    async addHiringTeamMember(
      session: SessionUser,
      jobOpeningId: string,
      employeeId: number,
      role: HiringTeamRole
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);
      const job = await repository.getJob(jobOpeningId, { includeCompensation: false });
      if (!job || job.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, isActive: true },
        select: { id: true },
      });
      if (!employee) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Employee not found or inactive.");
      }

      if (role === HiringTeamRole.hiring_manager) {
        const hmCount = await repository.countHiringManagers(jobOpeningId);
        const alreadyHm = job.hiringTeam.some(
          (m) => m.role === HiringTeamRole.hiring_manager && m.employeeId === employeeId
        );
        if (hmCount > 0 && !alreadyHm) {
          throw new RecruitmentDomainError(
            "REC_JOB_SINGLE_HM",
            "A job opening may have at most one hiring manager."
          );
        }
        if (alreadyHm) return;
      }

      const duplicate = job.hiringTeam.some((m) => m.employeeId === employeeId && m.role === role);
      if (duplicate) return;

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.addHiringTeamMember(jobOpeningId, employeeId, role, tx);
        events.enqueue(
          RecruitmentEventFactory.hiringTeamChanged(actor, {
            jobOpeningId,
            employeeId,
            role,
            operation: "added",
          })
        );
      });
      await events.flush();
    },

    async removeHiringTeamMember(
      session: SessionUser,
      jobOpeningId: string,
      memberId: string
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);
      const actor = toRecruitmentActor(session);
      const job = await repository.getJob(jobOpeningId, { includeCompensation: false });
      if (!job || job.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }
      const member = job.hiringTeam.find((m) => m.id === memberId);
      if (!member) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Hiring team member not found.");
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.removeHiringTeamMember(memberId, tx);
        events.enqueue(
          RecruitmentEventFactory.hiringTeamChanged(actor, {
            jobOpeningId,
            employeeId: member.employeeId,
            role: member.role,
            operation: "removed",
          })
        );
      });
      await events.flush();
    },

    /**
     * Publish/unpublish a job on the public career portal (/apply). Slug is
     * assigned once, on first publish, and kept stable across later
     * unpublish/republish so a link HR has already shared never rots.
     */
    async setPublicListing(
      session: SessionUser,
      jobOpeningId: string,
      input: { isPubliclyListed: boolean }
    ): Promise<{ isPubliclyListed: boolean; publicSlug: string | null }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageJobs(session);

      const job = await repository.getJob(jobOpeningId, { includeCompensation: false });
      if (!job || job.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Job opening not found.");
      }

      // Eligibility (Phase-3 design §3, §19-P): the public /apply list/detail
      // query already filters on status === open, so a non-open job could
      // never actually be *reached* by a candidate even if this flag were
      // true — but letting HR flip "on" for a draft/closed/on-hold job would
      // produce a link that silently 404s for every candidate who opens it.
      // Reuse the existing status enum rather than inventing new rules.
      if (input.isPubliclyListed && job.status !== JobOpeningStatus.open) {
        throw new RecruitmentDomainError(
          "REC_JOB_ILLEGAL_STATUS",
          "Only open jobs can be listed publicly. Open this job first, then publish it."
        );
      }

      const existing = await prisma.jobOpening.findUnique({
        where: { id: jobOpeningId },
        select: { publicSlug: true },
      });

      let publicSlug = existing?.publicSlug ?? null;
      if (input.isPubliclyListed && !publicSlug) {
        publicSlug = await generateUniqueJobSlug(job.title, async (candidate) => {
          const clash = await prisma.jobOpening.findUnique({
            where: { publicSlug: candidate },
            select: { id: true },
          });
          return Boolean(clash);
        });
      }

      await prisma.jobOpening.update({
        where: { id: jobOpeningId },
        data: { isPubliclyListed: input.isPubliclyListed, publicSlug },
      });

      return { isPubliclyListed: input.isPubliclyListed, publicSlug };
    },
  };
}

export const JobOpeningService = createJobOpeningService();
