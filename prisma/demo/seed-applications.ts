import {
  ApplicationPriority,
  ApplicationStatus,
  CandidateSource,
  RecruitmentPipelineStage,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/client";
import { ACTIVE_PIPELINE_PATH, SOURCE_CATALOG } from "./constants";
import type { DemoApplicationRef, DemoSeedContext } from "./context";
import {
  addDays,
  chunk,
  daysAgo,
  demoMeta,
  logStep,
  pick,
  TX_OPTS,
} from "./helpers";

type OutcomeBucket =
  | "applied"
  | "screening"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "hired"
  | "stuck";

function bucketForIndex(i: number): OutcomeBucket {
  const m = i % 20;
  if (m < 3) return "applied";
  if (m < 5) return "screening";
  if (m < 7) return "assessment";
  if (m < 11) return "interview";
  if (m < 13) return "offer";
  if (m < 15) return "rejected";
  if (m < 16) return "withdrawn";
  if (m < 18) return "hired";
  return "stuck";
}

function stageForBucket(
  bucket: OutcomeBucket,
  rng: () => number
): {
  stage: RecruitmentPipelineStage;
  status: ApplicationStatus;
  pathEnd: number;
} {
  switch (bucket) {
    case "applied":
      return { stage: RecruitmentPipelineStage.resume_received, status: ApplicationStatus.active, pathEnd: 0 };
    case "screening":
      return { stage: RecruitmentPipelineStage.screening, status: ApplicationStatus.active, pathEnd: 1 };
    case "assessment":
      return { stage: RecruitmentPipelineStage.assessment, status: ApplicationStatus.active, pathEnd: 2 };
    case "interview":
      return {
        stage: pick(rng, [
          RecruitmentPipelineStage.technical_round,
          RecruitmentPipelineStage.hr_round,
          RecruitmentPipelineStage.manager_round,
        ]),
        status: ApplicationStatus.active,
        pathEnd: 4,
      };
    case "offer":
      return { stage: RecruitmentPipelineStage.offer, status: ApplicationStatus.active, pathEnd: 7 };
    case "rejected":
      return { stage: RecruitmentPipelineStage.rejected, status: ApplicationStatus.rejected, pathEnd: 3 };
    case "withdrawn":
      return { stage: RecruitmentPipelineStage.withdrawn, status: ApplicationStatus.withdrawn, pathEnd: 2 };
    case "hired":
      return { stage: RecruitmentPipelineStage.hired, status: ApplicationStatus.hired, pathEnd: 8 };
    case "stuck":
      return { stage: RecruitmentPipelineStage.technical_round, status: ApplicationStatus.active, pathEnd: 4 };
  }
}

export async function seedApplications(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding applications + stage history + timelines…");
  const { prisma, rng, candidates, jobs, actors } = ctx;
  const openishJobs = jobs.filter((j) =>
    ["open", "on_hold", "filled", "closed"].includes(j.status)
  );
  if (!openishJobs.length) throw new Error("No jobs available for applications.");

  const applications: DemoApplicationRef[] = [];
  const usedPairs = new Set<string>();

  type Planned = {
    candidateId: string;
    jobOpeningId: string;
    ownerUserId: string;
    hmEmployeeId: number;
    bucket: OutcomeBucket;
    stage: RecruitmentPipelineStage;
    status: ApplicationStatus;
    pathEnd: number;
    createdAt: Date;
    stageEnteredAt: Date;
    source: CandidateSource;
    priority: ApplicationPriority;
    aggregateScore: number;
  };

  const planned: Planned[] = [];

  for (const cand of candidates) {
    const appCount = 1 + Math.floor(rng() * 3); // 1–3
    for (let a = 0; a < appCount; a++) {
      const job = openishJobs[(cand.index * 3 + a * 5) % openishJobs.length]!;
      const pairKey = `${cand.id}:${job.id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      const bucket = bucketForIndex(cand.index + a * 7);
      const { stage, status, pathEnd } = stageForBucket(bucket, rng);
      const age =
        bucket === "stuck"
          ? 35 + Math.floor(rng() * 40)
          : bucket === "hired"
            ? 20 + Math.floor(rng() * 40)
            : 3 + Math.floor(rng() * 90);
      const createdAt = daysAgo(age, 10);
      const stageEnteredAt =
        bucket === "stuck" ? daysAgo(25 + Math.floor(rng() * 20), 11) : daysAgo(Math.max(1, Math.floor(age / 3)), 12);
      const src = SOURCE_CATALOG[(cand.index + a) % SOURCE_CATALOG.length]!;

      planned.push({
        candidateId: cand.id,
        jobOpeningId: job.id,
        ownerUserId: job.ownerUserId,
        hmEmployeeId: job.hmEmployeeId,
        bucket,
        stage,
        status,
        pathEnd,
        createdAt,
        stageEnteredAt,
        source: src.enum as CandidateSource,
        priority: pick(rng, [
          ApplicationPriority.low,
          ApplicationPriority.normal,
          ApplicationPriority.normal,
          ApplicationPriority.high,
          ApplicationPriority.critical,
        ]),
        aggregateScore: Math.round((55 + rng() * 40) * 10) / 10,
      });
    }
  }

  for (const batch of chunk(planned, 15)) {
    await prisma.$transaction(async (tx) => {
      for (const p of batch) {
        const existing = await tx.application.findFirst({
          where: {
            candidateId: p.candidateId,
            jobOpeningId: p.jobOpeningId,
            deletedAt: null,
          },
        });

        const common = {
          status: p.status,
          currentStage: p.stage,
          stageEnteredAt: p.stageEnteredAt,
          priority: p.priority,
          assignedRecruiterUserId: p.ownerUserId,
          assignedManagerEmployeeId: p.hmEmployeeId,
          source: p.source,
          aggregateScore: p.aggregateScore,
          rejectedReason:
            p.status === ApplicationStatus.rejected
              ? pick(rng, [
                  "Skills mismatch for role level",
                  "Compensation expectations above band",
                  "Failed technical assessment",
                  "Culture / communication fit",
                ])
              : null,
          withdrawnReason:
            p.status === ApplicationStatus.withdrawn
              ? pick(rng, ["Accepted another offer", "Personal reasons", "Relocation constraints"])
              : null,
          holdReason: p.bucket === "stuck" ? "Waiting on panel availability" : null,
          createdByUserId: p.ownerUserId,
          createdAt: p.createdAt,
          deletedAt: null,
        };

        const app = existing
          ? await tx.application.update({ where: { id: existing.id }, data: common })
          : await tx.application.create({
              data: {
                candidateId: p.candidateId,
                jobOpeningId: p.jobOpeningId,
                ...common,
              },
            });

        await tx.applicationStageHistory.deleteMany({ where: { applicationId: app.id } });

        const path = ACTIVE_PIPELINE_PATH.slice(0, p.pathEnd + 1);
        let cursor = new Date(p.createdAt);
        let from: RecruitmentPipelineStage | null = null;
        const historyRows = [];
        for (let i = 0; i < path.length; i++) {
          const to = path[i] as RecruitmentPipelineStage;
          historyRows.push({
            applicationId: app.id,
            fromStage: from,
            toStage: to,
            note: i === 0 ? "Application created" : `Moved to ${to}`,
            isOverride: false,
            actorUserId: p.ownerUserId,
            createdAt: cursor,
          });
          from = to;
          cursor = addDays(cursor, 2 + Math.floor(rng() * 4));
        }

        if (p.stage === RecruitmentPipelineStage.rejected) {
          historyRows.push({
            applicationId: app.id,
            fromStage: from,
            toStage: RecruitmentPipelineStage.rejected,
            note: "Rejected after evaluation",
            isOverride: false,
            actorUserId: p.ownerUserId,
            createdAt: p.stageEnteredAt,
          });
        } else if (p.stage === RecruitmentPipelineStage.withdrawn) {
          historyRows.push({
            applicationId: app.id,
            fromStage: from,
            toStage: RecruitmentPipelineStage.withdrawn,
            note: "Candidate withdrew",
            isOverride: false,
            actorUserId: p.ownerUserId,
            createdAt: p.stageEnteredAt,
          });
        } else if (p.stage === RecruitmentPipelineStage.hired) {
          // ensure hired terminal in history
          if (from !== RecruitmentPipelineStage.hired) {
            historyRows.push({
              applicationId: app.id,
              fromStage: RecruitmentPipelineStage.offer,
              toStage: RecruitmentPipelineStage.hired,
              note: "Converted / hired",
              isOverride: false,
              actorUserId: actors.hr_manager.userId,
              createdAt: p.stageEnteredAt,
            });
          }
        }

        await tx.applicationStageHistory.createMany({ data: historyRows });

        await tx.recruitmentTimelineEvent.createMany({
          data: [
            {
              entityType: RecruitmentTimelineEntityType.application,
              entityId: app.id,
              applicationId: app.id,
              candidateId: p.candidateId,
              jobOpeningId: p.jobOpeningId,
              eventType: "application.created",
              summary: "Application submitted",
              actorUserId: p.ownerUserId,
              metadata: demoMeta({ bucket: p.bucket }),
              createdAt: p.createdAt,
            },
            {
              entityType: RecruitmentTimelineEntityType.candidate,
              entityId: p.candidateId,
              applicationId: app.id,
              candidateId: p.candidateId,
              jobOpeningId: p.jobOpeningId,
              eventType: "application.stage_changed",
              summary: `Now at stage ${p.stage}`,
              actorUserId: p.ownerUserId,
              metadata: demoMeta({ stage: p.stage }),
              createdAt: p.stageEnteredAt,
            },
          ],
        });

        applications.push({
          id: app.id,
          candidateId: p.candidateId,
          jobOpeningId: p.jobOpeningId,
          currentStage: p.stage,
          status: p.status,
          assignedRecruiterUserId: p.ownerUserId,
          createdAt: p.createdAt,
          stageEnteredAt: p.stageEnteredAt,
        });
      }
    }, TX_OPTS);
  }

  ctx.applications = applications;
  ctx.counts.applications = applications.length;
  logStep(`Applications ready (${applications.length}).`);
}
