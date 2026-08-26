/**
 * Phase 1 backfill for dynamic pipeline stages — purely additive, idempotent.
 *
 * Does three things, in order, and is safe to re-run (every write is
 * conditioned on the target column still being unset/absent):
 *
 *  1. For every JobOpening with zero JobOpeningStage rows, creates one
 *     JobOpeningStage per RecruitmentPipelineStage value (see
 *     DEFAULT_STAGE_SEED_ORDER / PIPELINE_STAGE_CATEGORY in
 *     src/lib/recruitment/shared/pipeline-stage-groups.ts) so every job has
 *     an exact-match stage row for whatever `currentStage` its applications
 *     already carry.
 *  2. For every Application with currentStageId IS NULL, sets it to the
 *     JobOpeningStage row matching (jobOpeningId, stage=currentStage); if no
 *     exact match exists (a job's real template stage list doesn't include
 *     that value), falls back to the lowest-sortOrder enabled stage in the
 *     same StageCategory for that job.
 *  3. For every ApplicationStageHistory row with fromStageId/toStageId IS
 *     NULL, does the same lookup for fromStage/toStage — history rows'
 *     createdAt/actorUserId/note/etc. are never touched, only the two new
 *     nullable FK columns are set.
 *
 * Never touches Application.currentStage, ApplicationStageHistory's
 * existing columns, or Decision/Offer/Conversion data.
 *
 * Usage:
 *   npx tsx prisma/scripts/backfill-dynamic-pipeline-stages.ts [--dry-run]
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { RecruitmentPipelineStage, StageCategory } from "@/generated/prisma/enums";
import {
  DEFAULT_STAGE_SEED_ORDER,
  PIPELINE_STAGE_CATEGORY,
  PIPELINE_STAGE_LABELS,
} from "@/lib/recruitment/shared/pipeline-stage-groups";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const BATCH_SIZE = 500;

async function seedMissingJobStages(
  prisma: PrismaClient,
  dryRun: boolean
): Promise<{ jobsSeeded: number; rowsCreated: number }> {
  const jobsWithoutStages = await prisma.jobOpening.findMany({
    where: { deletedAt: null, stages: { none: {} } },
    select: { id: true },
  });

  if (jobsWithoutStages.length === 0) {
    return { jobsSeeded: 0, rowsCreated: 0 };
  }

  console.log(
    `[backfill] ${jobsWithoutStages.length} job opening(s) have no JobOpeningStage rows — seeding standard defaults.`
  );

  let rowsCreated = 0;
  for (const job of jobsWithoutStages) {
    const data: Prisma.JobOpeningStageCreateManyInput[] = DEFAULT_STAGE_SEED_ORDER.map(
      (stage, index) => ({
        jobOpeningId: job.id,
        stage,
        category: PIPELINE_STAGE_CATEGORY[stage],
        sortOrder: index,
        label: PIPELINE_STAGE_LABELS[stage],
      })
    );

    if (dryRun) {
      rowsCreated += data.length;
      continue;
    }

    const result = await prisma.jobOpeningStage.createMany({
      data,
      skipDuplicates: true,
    });
    rowsCreated += result.count;
  }

  return { jobsSeeded: jobsWithoutStages.length, rowsCreated };
}

/** Best-effort JobOpeningStage lookup for a given job + legacy enum stage value. */
function buildStageResolver(
  stageRows: { id: string; jobOpeningId: string; stage: RecruitmentPipelineStage; category: StageCategory; sortOrder: number }[]
) {
  const byJobAndStage = new Map<string, string>();
  const byJobAndCategory = new Map<string, { id: string; sortOrder: number }>();

  for (const row of stageRows) {
    byJobAndStage.set(`${row.jobOpeningId}:${row.stage}`, row.id);

    const categoryKey = `${row.jobOpeningId}:${row.category}`;
    const existing = byJobAndCategory.get(categoryKey);
    if (!existing || row.sortOrder < existing.sortOrder) {
      byJobAndCategory.set(categoryKey, { id: row.id, sortOrder: row.sortOrder });
    }
  }

  return function resolve(jobOpeningId: string, stage: RecruitmentPipelineStage): string | null {
    const exact = byJobAndStage.get(`${jobOpeningId}:${stage}`);
    if (exact) return exact;
    const category = PIPELINE_STAGE_CATEGORY[stage];
    const fallback = byJobAndCategory.get(`${jobOpeningId}:${category}`);
    return fallback?.id ?? null;
  };
}

async function loadStageResolver(prisma: PrismaClient) {
  const stageRows = await prisma.jobOpeningStage.findMany({
    select: { id: true, jobOpeningId: true, stage: true, category: true, sortOrder: true },
  });
  return buildStageResolver(stageRows);
}

async function backfillApplicationCurrentStageId(
  prisma: PrismaClient,
  dryRun: boolean
): Promise<{ updated: number; unresolved: number }> {
  const resolveStage = await loadStageResolver(prisma);

  let updated = 0;
  let unresolved = 0;
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.application.findMany({
      where: { currentStageId: null },
      select: { id: true, jobOpeningId: true, currentStage: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    for (const app of batch) {
      const stageId = resolveStage(app.jobOpeningId, app.currentStage);
      if (!stageId) {
        unresolved += 1;
        continue;
      }
      if (!dryRun) {
        await prisma.application.update({
          where: { id: app.id },
          data: { currentStageId: stageId },
        });
      }
      updated += 1;
    }

    if (batch.length < BATCH_SIZE) break;
  }

  return { updated, unresolved };
}

async function backfillStageHistoryIds(
  prisma: PrismaClient,
  dryRun: boolean
): Promise<{ updated: number; unresolved: number }> {
  const resolveStage = await loadStageResolver(prisma);

  let updated = 0;
  let unresolved = 0;
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.applicationStageHistory.findMany({
      where: { OR: [{ toStageId: null }, { fromStageId: null, fromStage: { not: null } }] },
      select: {
        id: true,
        fromStage: true,
        toStage: true,
        fromStageId: true,
        toStageId: true,
        application: { select: { jobOpeningId: true } },
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1]!.id;

    for (const row of batch) {
      const jobOpeningId = row.application.jobOpeningId;
      const data: Prisma.ApplicationStageHistoryUpdateInput = {};
      let resolvedAny = false;

      if (!row.toStageId) {
        const toStageId = resolveStage(jobOpeningId, row.toStage);
        if (toStageId) {
          data.toStageRef = { connect: { id: toStageId } };
          resolvedAny = true;
        } else {
          unresolved += 1;
        }
      }

      if (!row.fromStageId && row.fromStage) {
        const fromStageId = resolveStage(jobOpeningId, row.fromStage);
        if (fromStageId) {
          data.fromStageRef = { connect: { id: fromStageId } };
          resolvedAny = true;
        }
      }

      if (resolvedAny) {
        if (!dryRun) {
          await prisma.applicationStageHistory.update({ where: { id: row.id }, data });
        }
        updated += 1;
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  return { updated, unresolved };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[backfill] Starting dynamic-pipeline-stages backfill (dryRun=${dryRun}).`);

  const prisma = createPrismaClient();
  try {
    const seedResult = await seedMissingJobStages(prisma, dryRun);
    console.log(
      `[backfill] Step 1/3 — job stage seeding: ${seedResult.jobsSeeded} job(s), ${seedResult.rowsCreated} JobOpeningStage row(s)${dryRun ? " (dry run, not written)" : ""}.`
    );

    const appResult = await backfillApplicationCurrentStageId(prisma, dryRun);
    console.log(
      `[backfill] Step 2/3 — Application.currentStageId: ${appResult.updated} updated, ${appResult.unresolved} left unresolved (no matching stage found)${dryRun ? " (dry run, not written)" : ""}.`
    );

    const historyResult = await backfillStageHistoryIds(prisma, dryRun);
    console.log(
      `[backfill] Step 3/3 — ApplicationStageHistory fromStageId/toStageId: ${historyResult.updated} row(s) updated, ${historyResult.unresolved} toStageId left unresolved${dryRun ? " (dry run, not written)" : ""}.`
    );

    console.log("[backfill] Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[backfill] dynamic-pipeline-stages backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
