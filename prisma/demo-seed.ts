/**
 * ZEBL AMS — Recruitment Demo Data Seeder (orchestrator)
 *
 * Usage:
 *   npm run demo:seed
 *   npm run demo:seed -- --no-reset   # skip wipe (not recommended)
 *
 * Idempotent: default run resets demo rows then reseeds.
 * Does NOT modify business logic or recruitment services.
 */
import type { DemoSeedContext } from "./demo/context";
import { DEMO_PASSWORD, DEMO_USERS, TARGETS } from "./demo/constants";
import {
  createDemoPrismaClient,
  createRng,
  ensureDefaultPipeline,
  loadEnvFiles,
  logStep,
} from "./demo/helpers";
import { resetDemoData } from "./demo/reset";
import { seedAnalytics } from "./demo/seed-analytics";
import { seedApplications } from "./demo/seed-applications";
import { seedCandidates } from "./demo/seed-candidates";
import { seedCommunications } from "./demo/seed-communications";
import { seedConversions } from "./demo/seed-conversions";
import { seedDocuments } from "./demo/seed-documents";
import { seedInterviews } from "./demo/seed-interviews";
import { seedJobs } from "./demo/seed-jobs";
import { seedOffers } from "./demo/seed-offers";
import { seedUsers } from "./demo/seed-users";

loadEnvFiles();

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const skipReset = args.has("--no-reset");

  const prisma = createDemoPrismaClient();
  const started = Date.now();

  try {
    if (!skipReset) {
      await resetDemoData(prisma);
    }

    logStep("Ensuring pipeline template + settings…");
    const pipeline = await ensureDefaultPipeline(prisma);

    const ctx: DemoSeedContext = {
      prisma,
      rng: createRng(20260805),
      actors: {} as DemoSeedContext["actors"],
      actorList: [],
      recruiters: [],
      pipelineTemplateId: pipeline.templateId,
      pipelineStages: pipeline.stages,
      jobs: [],
      candidates: [],
      applications: [],
      interviews: [],
      offers: [],
      templates: [],
      tagIds: {},
      demoTagId: "",
      counts: {},
    };

    await seedUsers(ctx);
    await seedJobs(ctx);
    await seedCandidates(ctx);
    await seedApplications(ctx);
    await seedDocuments(ctx);
    await seedInterviews(ctx);
    await seedOffers(ctx);
    await seedConversions(ctx);
    await seedCommunications(ctx);
    await seedAnalytics(ctx);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log("\n========================================");
    console.log(" ZEBL Recruitment Demo Seed Complete");
    console.log("========================================");
    console.log(` Company: ZEBL Technologies Pvt Ltd`);
    console.log(` Elapsed: ${elapsed}s`);
    console.log("\n Dataset summary:");
    for (const [k, v] of Object.entries(ctx.counts)) {
      console.log(`  - ${k}: ${v}`);
    }
    console.log(
      `\n Targets: ~${TARGETS.jobs} jobs, ${TARGETS.candidates} candidates, ${TARGETS.conversions} conversions`
    );
    console.log("\n Demo accounts (password for all):");
    console.log(`  ${DEMO_PASSWORD}`);
    for (const u of DEMO_USERS) {
      console.log(`  - ${u.email}  (${u.designation})`);
    }
    console.log("\n Next: log in and explore /admin/recruitment");
    console.log("========================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[demo-seed] FAILED:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
