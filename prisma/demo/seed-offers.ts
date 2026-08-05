import {
  HiringDecisionOutcome,
  OfferStatus,
  Prisma,
  RecruitmentPipelineStage,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/client";
import type { DemoOfferRef, DemoSeedContext } from "./context";
import { chunk, daysAgo, daysFromNow, demoMeta, logStep, pick } from "./helpers";

export async function seedOffers(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding hiring decisions, offers, revisions…");
  const { prisma, rng, applications, jobs, actors, candidates } = ctx;

  const offerEligible = applications.filter(
    (a) =>
      a.currentStage === RecruitmentPipelineStage.offer ||
      a.currentStage === RecruitmentPipelineStage.hired ||
      a.currentStage === RecruitmentPipelineStage.decision ||
      a.currentStage === RecruitmentPipelineStage.manager_round ||
      a.status === "hired"
  );

  // Also pull some rejected late-stage for declined offers
  const extra = applications
    .filter((a) => a.status === "rejected" && a.currentStage === RecruitmentPipelineStage.rejected)
    .slice(0, 15);

  const targets = [...offerEligible, ...extra];
  const offers: DemoOfferRef[] = [];
  let decisionCount = 0;
  let revisionCount = 0;

  // Status mix: accepted, pending(released), declined, withdrawn, expired(released past), draft, approvals
  const statusFor = (i: number, appStatus: string, stage: string): OfferStatus => {
    if (appStatus === "hired" || stage === RecruitmentPipelineStage.hired) return OfferStatus.accepted;
    const m = i % 10;
    if (m === 0) return OfferStatus.draft;
    if (m === 1) return OfferStatus.manager_approval;
    if (m === 2) return OfferStatus.hr_approval;
    if (m === 3) return OfferStatus.declined;
    if (m === 4) return OfferStatus.withdrawn;
    if (m === 5) return OfferStatus.released; // will mark expired via expiresAt
    if (m <= 7) return OfferStatus.released; // pending candidate response
    return OfferStatus.accepted;
  };

  for (const batch of chunk(targets, 25)) {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < batch.length; i++) {
        const app = batch[i]!;
        const job = jobs.find((j) => j.id === app.jobOpeningId);
        if (!job) continue;

        await tx.offer.deleteMany({ where: { applicationId: app.id } });
        await tx.hiringDecision.deleteMany({ where: { applicationId: app.id } });

        const status = statusFor(i + offers.length, app.status, app.currentStage);
        const mid = (job.compensationMin + job.compensationMax) / 2;
        const baseSalary = Math.round(mid * (0.9 + rng() * 0.2));
        const ctc = Math.round(baseSalary * 1.12);
        const outcome =
          status === OfferStatus.declined || app.status === "rejected"
            ? HiringDecisionOutcome.reject
            : status === OfferStatus.accepted
              ? pick(rng, [HiringDecisionOutcome.hire, HiringDecisionOutcome.strong_hire])
              : HiringDecisionOutcome.hire;

        const decision = await tx.hiringDecision.create({
          data: {
            applicationId: app.id,
            outcome,
            rationale: "[Demo] Decision based on interview panel consensus and role fit.",
            strengths: "Strong ownership, clear communication, relevant domain experience.",
            concerns: outcome === HiringDecisionOutcome.reject ? "Did not meet technical bar." : "Compensation sensitivity.",
            salaryRecommendation: new Prisma.Decimal(baseSalary),
            currency: "INR",
            riskTagsJson: [],
            version: 1,
            isCurrent: true,
            decidedByUserId: actors.hr_manager.userId,
            decidedAt: daysAgo(12 + (i % 10), 15),
          },
        });
        decisionCount += 1;

        const joiningDate = daysFromNow(20 + (i % 30), 9);
        const releasedAt =
          status === OfferStatus.draft ||
          status === OfferStatus.manager_approval ||
          status === OfferStatus.hr_approval
            ? null
            : daysAgo(8 + (i % 6), 14);
        const expiresAt =
          status === OfferStatus.released && (i + offers.length) % 10 === 5
            ? daysAgo(2, 18) // expired
            : daysFromNow(7 + (i % 5), 18);

        const offer = await tx.offer.create({
          data: {
            applicationId: app.id,
            hiringDecisionId: decision.id,
            status,
            currency: "INR",
            baseSalary: new Prisma.Decimal(baseSalary),
            variablePay: new Prisma.Decimal(Math.round(baseSalary * 0.1)),
            benefitsNotes: "Medical insurance, WFHO allowance, learning stipend",
            proposedStartDate: joiningDate,
            expiresAt,
            managerApprovalSkipped: status !== OfferStatus.manager_approval,
            managerApprovedByUserId:
              status === OfferStatus.draft || status === OfferStatus.manager_approval
                ? null
                : actors.eng_manager.userId,
            managerApprovedAt:
              status === OfferStatus.draft || status === OfferStatus.manager_approval
                ? null
                : daysAgo(10, 12),
            hrApprovedByUserId:
              status === OfferStatus.released ||
              status === OfferStatus.accepted ||
              status === OfferStatus.declined ||
              status === OfferStatus.withdrawn
                ? actors.hr_manager.userId
                : null,
            hrApprovedAt:
              status === OfferStatus.released ||
              status === OfferStatus.accepted ||
              status === OfferStatus.declined ||
              status === OfferStatus.withdrawn
                ? daysAgo(9, 13)
                : null,
            releasedAt,
            acceptedAt: status === OfferStatus.accepted ? daysAgo(4, 16) : null,
            declinedAt: status === OfferStatus.declined ? daysAgo(3, 11) : null,
            withdrawnAt: status === OfferStatus.withdrawn ? daysAgo(2, 10) : null,
            createdByUserId: app.assignedRecruiterUserId,
            createdAt: daysAgo(14, 10),
            offerNumber: `DEMO-OFF-${String(offers.length + 1).padStart(4, "0")}`,
            employmentType: job.employmentType === "intern" ? "Intern" : job.employmentType === "contract" ? "Contract" : "Full Time",
            department: job.department,
            location: job.location,
            grade: pick(rng, ["L3", "L4", "L5", "L6"]),
            reportingManagerId: job.hmEmployeeId,
            joiningDate,
            ctc: new Prisma.Decimal(ctc),
            salaryBreakdownJson: {
              basic: Math.round(baseSalary * 0.4),
              hra: Math.round(baseSalary * 0.2),
              special: Math.round(baseSalary * 0.3),
              pf: Math.round(baseSalary * 0.1),
            },
            bonus: new Prisma.Decimal(Math.round(baseSalary * 0.08)),
            probationDays: 90,
            noticeBuyout: rng() > 0.7,
            offerPdfKey: `demo/offers/DEMO-OFF-${offers.length + 1}.pdf`,
            offerNotes: "[Demo] Standard ZEBL offer package",
            sentAt: releasedAt,
          },
        });

        // Revision history
        await tx.offerRevision.create({
          data: {
            offerId: offer.id,
            version: 1,
            snapshotJson: {
              baseSalary,
              ctc,
              status: "draft",
            },
            changeNote: "Initial draft",
            actorUserId: app.assignedRecruiterUserId,
            createdAt: daysAgo(14, 10),
          },
        });
        await tx.offerRevision.create({
          data: {
            offerId: offer.id,
            version: 2,
            snapshotJson: {
              baseSalary: Math.round(baseSalary * 1.03),
              ctc: Math.round(ctc * 1.03),
              status: "revised",
            },
            changeNote: "Adjusted after HM feedback",
            actorUserId: actors.hr_manager.userId,
            createdAt: daysAgo(12, 11),
          },
        });
        revisionCount += 2;

        const cand = candidates.find((c) => c.id === app.candidateId);
        await tx.recruitmentTimelineEvent.create({
          data: {
            entityType: RecruitmentTimelineEntityType.offer,
            entityId: offer.id,
            applicationId: app.id,
            candidateId: app.candidateId,
            jobOpeningId: app.jobOpeningId,
            eventType: `offer.${status}`,
            summary: `Offer ${status} for ${cand?.fullName ?? "candidate"} — ${job.title}`,
            actorUserId: app.assignedRecruiterUserId,
            metadata: demoMeta({
              status,
              expired: Boolean(expiresAt && expiresAt < new Date() && status === OfferStatus.released),
            }),
            createdAt: offer.createdAt,
          },
        });

        offers.push({
          id: offer.id,
          applicationId: app.id,
          candidateId: app.candidateId,
          jobOpeningId: app.jobOpeningId,
          status,
          baseSalary,
          department: job.department,
          location: job.location,
          employmentType: job.employmentType,
          joiningDate,
          accepted: status === OfferStatus.accepted,
        });
      }
    });
  }

  ctx.offers = offers;
  ctx.counts.offers = offers.length;
  ctx.counts.decisions = decisionCount;
  ctx.counts.offerRevisions = revisionCount;
  logStep(`Offers ready (${offers.length}, decisions=${decisionCount}, revisions=${revisionCount}).`);
}
