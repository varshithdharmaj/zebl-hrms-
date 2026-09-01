/**
 * Standalone mock-offer seed for visual/flow testing:
 * Candidate (reused if it already exists) -> JobOpening (reused if it already
 * exists) -> Application -> HiringDecision(strong_hire) -> Offer(draft).
 *
 * Direct Prisma writes only — does not go through the recruitment server
 * actions/service layer.
 *
 * Run: npx tsx prisma/seed-single-mock-offer.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  HiringDecisionOutcome,
  JobEmploymentType,
  JobOpeningStatus,
  OfferStatus,
  PrismaClient,
  RecruitmentPipelineStage,
} from "@/generated/prisma/client";

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
  if (!url) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const APP_BASE_URL = "http://localhost:3000";

const CANDIDATE_EMAIL = "testname@example.com";
const JOB_TITLE = "Senior Medical Billing Specialist";
const JOB_DEPARTMENT = "Billing & Collections";
const JOB_LOCATION = "Hyderabad";

function generateOfferNumber(): string {
  const year = new Date().getFullYear();
  return `OFFER-${year}-MOCK-${Date.now().toString().slice(-6)}`;
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const actor = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!actor) {
      throw new Error("No active User found to act as createdBy/decidedBy — seed a user first.");
    }
    console.log(`[AMS] Using actor user id: ${actor.id}`);

    // Candidate — reuse by email if it already exists
    let candidate = await prisma.candidate.findFirst({
      where: { email: CANDIDATE_EMAIL },
    });
    if (candidate) {
      console.log(`[AMS] Candidate reused: ${candidate.id} (${candidate.fullName})`);
    } else {
      candidate = await prisma.candidate.create({
        data: {
          fullName: "testname",
          firstName: "test",
          lastName: "name",
          email: CANDIDATE_EMAIL,
          currentTitle: "Senior Medical Billing Specialist",
          location: "Hyderabad",
        },
      });
      console.log(`[AMS] Candidate created: ${candidate.id} (${candidate.fullName})`);
    }

    // Job Opening — reuse by title + department if it already exists
    let jobOpening = await prisma.jobOpening.findFirst({
      where: { title: JOB_TITLE, department: JOB_DEPARTMENT },
    });
    if (jobOpening) {
      console.log(`[AMS] JobOpening reused: ${jobOpening.id} (${jobOpening.title})`);
    } else {
      jobOpening = await prisma.jobOpening.create({
        data: {
          title: JOB_TITLE,
          department: JOB_DEPARTMENT,
          location: JOB_LOCATION,
          employmentType: JobEmploymentType.full_time,
          status: JobOpeningStatus.open,
          createdBy: { connect: { id: actor.id } },
        },
      });
      console.log(`[AMS] JobOpening created: ${jobOpening.id} (${jobOpening.title})`);
    }

    // Application — reuse the active one if it already exists (DB enforces at
    // most one active, non-deleted application per candidate x job pair via
    // recruitment_applications_active_candidate_job_uidx).
    let application = await prisma.application.findFirst({
      where: {
        candidateId: candidate.id,
        jobOpeningId: jobOpening.id,
        deletedAt: null,
        status: "active",
      },
    });
    if (application) {
      console.log(`[AMS] Application reused: ${application.id}`);
    } else {
      application = await prisma.application.create({
        data: {
          candidate: { connect: { id: candidate.id } },
          jobOpening: { connect: { id: jobOpening.id } },
          currentStage: RecruitmentPipelineStage.offer,
          createdBy: { connect: { id: actor.id } },
        },
      });
      console.log(`[AMS] Application created: ${application.id}`);
    }

    // Hiring Decision (strong_hire, current) — satisfies offer-creation guardrail.
    // Reuse the existing current decision if the application already has one
    // (applicationId+version is unique), otherwise create the next version.
    let decision = await prisma.hiringDecision.findFirst({
      where: { applicationId: application.id, isCurrent: true },
      orderBy: { version: "desc" },
    });
    if (decision) {
      console.log(`[AMS] HiringDecision reused: ${decision.id} (${decision.outcome}, isCurrent)`);
    } else {
      const lastVersion = await prisma.hiringDecision.findFirst({
        where: { applicationId: application.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      decision = await prisma.hiringDecision.create({
        data: {
          application: { connect: { id: application.id } },
          outcome: HiringDecisionOutcome.strong_hire,
          rationale: "Strong domain fit for senior medical billing role — mock seed.",
          strengths: "Deep medical billing/collections expertise.",
          version: (lastVersion?.version ?? 0) + 1,
          isCurrent: true,
          decidedBy: { connect: { id: actor.id } },
        },
      });
      console.log(`[AMS] HiringDecision created: ${decision.id} (strong_hire, isCurrent)`);
    }

    // Offer (draft) — direct insert, no server action / service layer
    const offer = await prisma.offer.create({
      data: {
        application: { connect: { id: application.id } },
        hiringDecision: { connect: { id: decision.id } },
        status: OfferStatus.draft,
        offerNumber: generateOfferNumber(),
        currency: "INR",
        baseSalary: 800000,
        bonus: 100000,
        ctc: 900000,
        department: JOB_DEPARTMENT,
        location: JOB_LOCATION,
        grade: "L2",
        employmentType: "Full-time",
        createdBy: { connect: { id: actor.id } },
      },
    });
    console.log(`[AMS] Offer created (draft): ${offer.id} (${offer.offerNumber})`);

    console.log("\n[AMS] Mock offer ready. Inspect at:");
    console.log(`  ${APP_BASE_URL}/admin/recruitment/offers/${offer.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] seed-single-mock-offer failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
