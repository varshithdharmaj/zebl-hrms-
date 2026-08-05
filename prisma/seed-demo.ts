/**
 * ZEBL AMS — Minimal Enterprise Recruitment Demo
 *
 * npm run seed:demo
 * npm run seed:demo -- --force
 *
 * Curated ~150–200 rows. Idempotent (skips when MIN-JOB-01 exists).
 */
import { DEMO_PASSWORD } from "./recruitment-demo/catalog";
import {
  createPrisma,
  ensureSession,
  isMinDemoPresent,
  loadEnvFiles,
  log,
  type DemoCtx,
} from "./recruitment-demo/helpers";
import { seedEmployees } from "./recruitment-demo/employees";
import { seedJobs } from "./recruitment-demo/jobs";
import { seedCandidates } from "./recruitment-demo/candidates";
import { seedApplications } from "./recruitment-demo/applications";
import { seedInterviews } from "./recruitment-demo/interviews";
import { seedOffers } from "./recruitment-demo/offers";
import { seedConversions } from "./recruitment-demo/conversions";
import { seedCommunications } from "./recruitment-demo/communications";
import { seedTimeline } from "./recruitment-demo/timeline";
import { seedAnalytics } from "./recruitment-demo/analytics";

loadEnvFiles();

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const prisma = createPrisma();
  const t0 = Date.now();

  try {
    if (!force && (await isMinDemoPresent(prisma))) {
      log("Minimal demo already present (MIN-JOB-01). Use --force to refresh status paths.");
      log(`Login: hr.head@zebl.demo / ${DEMO_PASSWORD}`);
      return;
    }

    const bootstrap: DemoCtx = {
      prisma,
      session: {
        id: "bootstrap",
        email: "bootstrap@zebl.demo",
        role: "hr",
        employeeId: null,
        employeeName: null,
        sessionVersion: 1,
        authProvider: "local",
      },
      force,
      staff: new Map(),
      jobs: new Map(),
      candidates: new Map(),
      apps: new Map(),
      interviews: [],
      offers: new Map(),
      templates: new Map(),
      counts: {},
    };

    await seedEmployees(bootstrap);
    bootstrap.session = await ensureSession(prisma);

    await seedJobs(bootstrap);
    await seedCandidates(bootstrap);
    await seedApplications(bootstrap);
    await seedInterviews(bootstrap);
    await seedOffers(bootstrap);
    await seedConversions(bootstrap);
    await seedCommunications(bootstrap);
    await seedTimeline(bootstrap);
    await seedAnalytics(bootstrap);

    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("\n======== Minimal Recruitment Demo Ready ========");
    console.log(`Elapsed: ${sec}s`);
    for (const [k, v] of Object.entries(bootstrap.counts)) {
      console.log(`  ${k}: ${v}`);
    }
    console.log(`\nPassword (all): ${DEMO_PASSWORD}`);
    console.log("  hr.head@zebl.demo     — HR Head");
    console.log("  recruiter1@zebl.demo  — Recruiter");
    console.log("  recruiter2@zebl.demo  — Recruiter");
    console.log("  hm.eng@zebl.demo      — Engineering Manager");
    console.log("Explore: /admin/recruitment");
    console.log("================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed:demo] FAILED:", e instanceof Error ? e.message : e);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
