import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { CANDIDATES, type Purpose } from "./catalog";
import { daysAgo, log, type DemoCtx } from "./helpers";

const STAGE: Partial<Record<Purpose, RecruitmentPipelineStage>> = {
  applied: RecruitmentPipelineStage.resume_received,
  screening: RecruitmentPipelineStage.screening,
  assessment: RecruitmentPipelineStage.assessment,
  technical: RecruitmentPipelineStage.technical_round,
  manager: RecruitmentPipelineStage.manager_round,
  hr: RecruitmentPipelineStage.hr_round,
  offer: RecruitmentPipelineStage.offer,
  hired: RecruitmentPipelineStage.offer,
  offer_accepted: RecruitmentPipelineStage.offer,
  offer_declined: RecruitmentPipelineStage.offer,
  offer_expired: RecruitmentPipelineStage.offer,
  offer_withdrawn: RecruitmentPipelineStage.offer,
  pending_conversion: RecruitmentPipelineStage.offer,
};

function jobFor(purpose: Purpose, index: number): string {
  if (purpose === "hired" || purpose === "offer_accepted" || purpose === "pending_conversion") {
    return "MIN-JOB-05"; // filled job path
  }
  if (index % 2 === 0) return "MIN-JOB-01";
  return "MIN-JOB-02";
}

async function ensureApp(
  ctx: DemoCtx,
  svc: ReturnType<typeof createApplicationService>,
  candidateId: string,
  jobCode: string,
  purpose: string,
  ageDays: number
): Promise<string | null> {
  const job = ctx.jobs.get(jobCode);
  if (!job) return null;
  const key = `${candidateId}:${job.id}`;

  const existing = await ctx.prisma.application.findFirst({
    where: { candidateId, jobOpeningId: job.id, deletedAt: null },
  });
  if (existing) {
    ctx.apps.set(key, {
      id: existing.id,
      candidateId,
      jobId: job.id,
      purpose,
    });
    return existing.id;
  }

  try {
    const { id } = await svc.createApplication(ctx.session, {
      candidateId,
      jobOpeningId: job.id,
      priority: purpose.includes("offer") ? "high" : "normal",
    });
    await svc.updateApplication(ctx.session, {
      id,
      assignedRecruiterUserId: ctx.staff.get("rec_1")!.userId,
      assignedManagerEmployeeId: ctx.staff.get("hm_eng")!.id,
    });
    await ctx.prisma.application.update({
      where: { id },
      data: {
        createdAt: daysAgo(ageDays, 10),
        stageEnteredAt: daysAgo(Math.max(1, Math.floor(ageDays / 2)), 12),
      },
    });
    ctx.apps.set(key, { id, candidateId, jobId: job.id, purpose });
    return id;
  } catch (err) {
    if (err instanceof RecruitmentDomainError && err.code === "REC_CONFLICT") {
      const found = await ctx.prisma.application.findFirst({
        where: { candidateId, jobOpeningId: job.id, deletedAt: null },
      });
      if (found) {
        ctx.apps.set(key, {
          id: found.id,
          candidateId,
          jobId: job.id,
          purpose,
        });
        return found.id;
      }
    }
    throw err;
  }
}

export async function seedApplications(ctx: DemoCtx): Promise<void> {
  log("Applications (~15) via ApplicationService…");
  const svc = createApplicationService();
  let n = 0;

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]!;
    const cand = ctx.candidates.get(c.key);
    if (!cand) continue;

    const jobCode = jobFor(c.purpose, i);
    const age = 8 + i * 4;
    const appId = await ensureApp(ctx, svc, cand.id, jobCode, c.purpose, age);
    if (!appId) continue;
    n += 1;

    // Multi-application: c01 also applies to second open job
    if (c.key === "c01") {
      const second = await ensureApp(ctx, svc, cand.id, "MIN-JOB-02", "screening", age - 2);
      if (second) n += 1;
    }

    try {
      if (c.purpose === "rejected") {
        await svc.moveToStage(ctx.session, {
          id: appId,
          stage: RecruitmentPipelineStage.screening,
          note: "Screened",
        });
        await svc.rejectApplication(ctx.session, {
          id: appId,
          reason: "Skills mismatch for current bar",
        });
      } else if (c.purpose === "withdrawn") {
        await svc.moveToStage(ctx.session, {
          id: appId,
          stage: RecruitmentPipelineStage.assessment,
          note: "Assessment sent",
        });
        await svc.withdrawApplication(ctx.session, {
          id: appId,
          reason: "Accepted another offer",
        });
      } else {
        const stage = STAGE[c.purpose];
        if (stage && stage !== RecruitmentPipelineStage.resume_received) {
          await svc.moveToStage(ctx.session, {
            id: appId,
            stage,
            note: `Demo: ${c.purpose}`,
          });
        }
      }
    } catch (err) {
      log(`  warn ${c.key}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Duplicate application prevention (same candidate + job)
  const c01 = ctx.candidates.get("c01");
  const job1 = ctx.jobs.get("MIN-JOB-01");
  if (c01 && job1) {
    try {
      await svc.createApplication(ctx.session, {
        candidateId: c01.id,
        jobOpeningId: job1.id,
      });
    } catch {
      /* expected conflict */
    }
  }

  ctx.counts.applications = n;
}
