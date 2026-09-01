/**
 * Isolated end-to-end simulation of the candidate → offer pipeline:
 * Candidate -> JobOpening -> Application -> HiringDecision(strong_hire) -> Offer(draft).
 *
 * Run: npx tsx prisma/test-offer-flow.ts
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  HiringDecisionOutcome,
  JobEmploymentType,
  JobOpeningStatus,
  OfferStatus,
  PrismaClient,
} from "@/generated/prisma/client";
import { buildOfferLetterTemplateData } from "@/lib/recruitment/pdf/offer-letter-data";
import { renderOfferLetterPdf } from "@/lib/recruitment/pdf/render-offer-letter-pdf";

/** Counts physical pages in a PDF buffer without pulling in a parsing dependency. */
function countPdfPages(buffer: Buffer): number {
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

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

const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_CANDIDATE_EMAIL = "your.email@example.com";

function generateOfferNumber(): string {
  const year = new Date().getFullYear();
  return `OFFER-${year}-TEST-${Date.now().toString().slice(-6)}`;
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

    // Step 1: Candidate
    const candidate = await prisma.candidate.create({
      data: {
        fullName: "Vikram Mehta",
        firstName: "Vikram",
        lastName: "Mehta",
        email: TEST_CANDIDATE_EMAIL,
        currentTitle: "Medical Coding Specialist",
        location: "Hyderabad",
      },
    });
    console.log(`[AMS] Step 1 — Candidate created: ${candidate.id} (${candidate.fullName})`);

    // Step 2: Job Opening
    const jobOpening = await prisma.jobOpening.create({
      data: {
        title: "Lead Medical Coder - RCM",
        department: "Medical Coding",
        location: "Hyderabad",
        employmentType: JobEmploymentType.full_time,
        status: JobOpeningStatus.open,
        createdBy: { connect: { id: actor.id } },
      },
    });
    console.log(`[AMS] Step 2 — JobOpening created: ${jobOpening.id} (${jobOpening.title})`);

    // Step 3: Application
    const application = await prisma.application.create({
      data: {
        candidate: { connect: { id: candidate.id } },
        jobOpening: { connect: { id: jobOpening.id } },
        createdBy: { connect: { id: actor.id } },
      },
    });
    console.log(`[AMS] Step 3 — Application created: ${application.id}`);

    // Step 4: Hiring Decision (strong_hire, current) — satisfies offer-creation guardrail
    const decision = await prisma.hiringDecision.create({
      data: {
        application: { connect: { id: application.id } },
        outcome: HiringDecisionOutcome.strong_hire,
        rationale: "Strong technical and domain fit for RCM lead role — test seed.",
        strengths: "Deep medical coding expertise, RCM leadership experience.",
        version: 1,
        isCurrent: true,
        decidedBy: { connect: { id: actor.id } },
      },
    });
    console.log(`[AMS] Step 4 — HiringDecision created: ${decision.id} (strong_hire, isCurrent)`);

    // Step 5: Draft Offer — salary breakup matches the 2-page layout verification
    // figures (Special Allowance adjusted 19,652 -> 19,650/mo so the breakup foots
    // exactly to the 900,000 CTC; the service enforces exact equality).
    const salaryBreakdownJson = {
      basicMonthly: 37500,
      hraMonthly: 15000,
      conveyanceMonthly: 1600,
      medicalMonthly: 1250,
      specialMonthly: 19650,
    };
    const offer = await prisma.offer.create({
      data: {
        application: { connect: { id: application.id } },
        hiringDecision: { connect: { id: decision.id } },
        status: OfferStatus.draft,
        offerNumber: generateOfferNumber(),
        currency: "INR",
        baseSalary: 900000,
        ctc: 900000,
        department: "Medical Coding",
        location: "Hyderabad",
        grade: "L3",
        joiningDate: new Date("2026-10-01T00:00:00.000Z"),
        probationDays: 90,
        salaryBreakdownJson,
        createdBy: { connect: { id: actor.id } },
      },
    });
    console.log(`[AMS] Step 5 — Offer created (draft): ${offer.id} (${offer.offerNumber})`);

    // Step 6: Render the offer letter and verify the 2-page layout constraint.
    const templateData = buildOfferLetterTemplateData({
      offer: {
        id: offer.id,
        offerNumber: offer.offerNumber,
        department: offer.department,
        location: offer.location,
        ctc: 900000,
        joiningDate: offer.joiningDate,
        probationDays: offer.probationDays,
        noticeBuyout: offer.noticeBuyout,
        salaryBreakdownJson,
      },
      designation: jobOpening.title,
      candidateName: candidate.fullName,
    });
    const pdfBuffer = await renderOfferLetterPdf(templateData);
    const pageCount = countPdfPages(pdfBuffer);
    const outPath = resolve(process.cwd(), "storage", "test-offer-flow-letter.pdf");
    writeFileSync(outPath, pdfBuffer);
    console.log(`[AMS] Step 6 — Offer letter rendered: ${pageCount} page(s) -> ${outPath}`);
    // Verified via direct rendering: page 1 holds clauses 1-13, page 2 holds
    // clauses 14-20 + Authorized Signatory sign-off + Annexure + Candidate
    // Acceptance, with confirmed clearance above the letterhead footer band
    // on both pages. Flag anything else as a real layout regression.
    if (pageCount !== 2) {
      console.warn(`[AMS] WARNING: expected 2 pages (verified safe layout), got ${pageCount}.`);
    }

    console.log("\n[AMS] Flow complete. Open in browser:");
    console.log(`  Application: ${APP_BASE_URL}/admin/recruitment/applications/${application.id}`);
    console.log(`  Offer (edit): ${APP_BASE_URL}/admin/recruitment/offers/${offer.id}/edit`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] test-offer-flow failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
