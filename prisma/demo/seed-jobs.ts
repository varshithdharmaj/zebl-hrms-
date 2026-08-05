import {
  HiringTeamRole,
  JobEmploymentType,
  JobOpeningStatus,
  RecruitmentDocumentType,
  RecruitmentPipelineStage,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/client";
import { JOB_CATALOG } from "./constants";
import type { DemoJobRef, DemoSeedContext } from "./context";
import { addDays, daysAgo, demoMeta, logStep } from "./helpers";

const EMPLOYMENT_MAP: Record<string, JobEmploymentType> = {
  full_time: JobEmploymentType.full_time,
  intern: JobEmploymentType.intern,
  contract: JobEmploymentType.contract,
};

const STATUS_MAP: Record<string, JobOpeningStatus> = {
  draft: JobOpeningStatus.draft,
  open: JobOpeningStatus.open,
  on_hold: JobOpeningStatus.on_hold,
  closed: JobOpeningStatus.closed,
  filled: JobOpeningStatus.filled,
};

export async function seedJobs(ctx: DemoSeedContext): Promise<void> {
  logStep(`Seeding ${JOB_CATALOG.length} job openings…`);
  const { prisma, actors, pipelineTemplateId, pipelineStages } = ctx;
  const jobs: DemoJobRef[] = [];

  for (let i = 0; i < JOB_CATALOG.length; i++) {
    const def = JOB_CATALOG[i]!;
    const owner = actors[def.ownerKey];
    const hm = actors[def.hmKey];
    const createdAt = daysAgo(90 - i * 2, 9);
    const status = STATUS_MAP[def.status]!;
    const publishedAt =
      status === JobOpeningStatus.draft ? null : daysAgo(80 - i * 2, 11);
    const closedAt =
      status === JobOpeningStatus.closed || status === JobOpeningStatus.filled
        ? daysAgo(10 + (i % 7), 16)
        : null;
    const filledAt = status === JobOpeningStatus.filled ? closedAt : null;

    const description = [
      `${def.title} at ZEBL Technologies Pvt Ltd (${def.department}).`,
      `Location: ${def.location} · Mode: ${def.workMode}.`,
      `We are looking for someone who thrives in a product-led engineering culture.`,
      `Responsibilities include delivery ownership, collaboration with cross-functional partners, and raising the quality bar.`,
    ].join("\n\n");

    const requirements = [
      "3+ years relevant experience (intern roles: strong fundamentals)",
      "Excellent communication and ownership mindset",
      "Comfortable in a hybrid/remote collaboration setup",
      `Domain skills aligned to ${def.department}`,
    ].join("\n");

    const job = await prisma.jobOpening.upsert({
      where: { code: def.code },
      create: {
        title: def.title,
        code: def.code,
        status,
        department: def.department,
        location: def.location,
        workMode: def.workMode,
        employmentType: EMPLOYMENT_MAP[def.employmentType]!,
        description,
        requirements,
        openingsCount: def.openingsCount,
        headcountApproved: status !== JobOpeningStatus.draft,
        headcountRequestedByEmployeeId: hm.employeeId,
        headcountRequestedAt: createdAt,
        headcountUrgency: i % 4 === 0 ? "high" : "normal",
        compensationCurrency: "INR",
        compensationMin: def.compensationMin,
        compensationMax: def.compensationMax,
        targetStartDate: addDays(createdAt, 45),
        pipelineTemplateId,
        ownerRecruiterUserId: owner.userId,
        publishedAt,
        closedAt,
        filledAt,
        createdByUserId: actors.hr_manager.userId,
        createdAt,
      },
      update: {
        title: def.title,
        status,
        department: def.department,
        location: def.location,
        workMode: def.workMode,
        employmentType: EMPLOYMENT_MAP[def.employmentType]!,
        description,
        requirements,
        openingsCount: def.openingsCount,
        compensationMin: def.compensationMin,
        compensationMax: def.compensationMax,
        ownerRecruiterUserId: owner.userId,
        publishedAt,
        closedAt,
        filledAt,
        deletedAt: null,
      },
    });

    await prisma.jobOpeningStage.deleteMany({ where: { jobOpeningId: job.id } });
    await prisma.jobOpeningStage.createMany({
      data: pipelineStages.map((s) => ({
        jobOpeningId: job.id,
        stage: s.stage as RecruitmentPipelineStage,
        sortOrder: s.sortOrder,
        isOptional: s.isOptional,
        isEnabled: true,
        label: s.label,
        slaDays: s.slaDays,
      })),
    });

    await prisma.hiringTeamMember.deleteMany({ where: { jobOpeningId: job.id } });
    await prisma.hiringTeamMember.createMany({
      data: [
        {
          jobOpeningId: job.id,
          employeeId: owner.employeeId,
          role: HiringTeamRole.recruiter,
        },
        {
          jobOpeningId: job.id,
          employeeId: hm.employeeId,
          role: HiringTeamRole.hiring_manager,
        },
        {
          jobOpeningId: job.id,
          employeeId: actors.hiring_manager.employeeId,
          role: HiringTeamRole.interviewer,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.jobOpeningDocument.deleteMany({ where: { jobOpeningId: job.id } });
    await prisma.jobOpeningDocument.create({
      data: {
        jobOpeningId: job.id,
        documentType: RecruitmentDocumentType.other,
        fileName: `${def.code}-JD.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 120_000 + i * 1000,
        storageKey: `demo/jobs/${def.code}/jd.pdf`,
        uploadedByUserId: owner.userId,
        createdAt,
      },
    });

    await prisma.jobOpeningNote.deleteMany({
      where: { jobOpeningId: job.id, body: { startsWith: "[Demo]" } },
    });
    await prisma.jobOpeningNote.create({
      data: {
        jobOpeningId: job.id,
        body: `[Demo] Hiring plan for ${def.title}: prioritize strong ${def.department.toLowerCase()} fundamentals and culture fit.`,
        authorUserId: owner.userId,
        isPinned: i % 5 === 0,
        createdAt,
      },
    });

    await prisma.recruitmentTimelineEvent.create({
      data: {
        entityType: RecruitmentTimelineEntityType.job_opening,
        entityId: job.id,
        jobOpeningId: job.id,
        eventType: "job.created",
        summary: `Job opening created: ${def.title}`,
        actorUserId: actors.hr_manager.userId,
        metadata: demoMeta({ code: def.code }),
        createdAt,
      },
    });

    if (publishedAt) {
      await prisma.recruitmentTimelineEvent.create({
        data: {
          entityType: RecruitmentTimelineEntityType.job_opening,
          entityId: job.id,
          jobOpeningId: job.id,
          eventType: "job.published",
          summary: `Job published: ${def.title}`,
          actorUserId: owner.userId,
          metadata: demoMeta({ code: def.code }),
          createdAt: publishedAt,
        },
      });
    }

    jobs.push({
      id: job.id,
      code: def.code,
      title: def.title,
      department: def.department,
      location: def.location,
      employmentType: def.employmentType,
      status: def.status,
      ownerUserId: owner.userId,
      hmEmployeeId: hm.employeeId,
      compensationMin: def.compensationMin,
      compensationMax: def.compensationMax,
    });
  }

  ctx.jobs = jobs;
  ctx.counts.jobs = jobs.length;
  logStep(`Jobs ready (${jobs.length}).`);
}
