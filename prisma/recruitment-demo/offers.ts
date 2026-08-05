import { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { daysAgo, daysFromNow, iso, log, type DemoCtx } from "./helpers";

/** 5 offers covering pending / accepted×2 / declined / expired; withdrawn via service. */
export async function seedOffers(ctx: DemoCtx): Promise<void> {
  log("Offers (5) via OfferService…");
  const svc = createOfferService();
  const appSvc = createApplicationService();

  const need = [
    { purpose: "offer", outcome: "pending" as const },
    { purpose: "hired", outcome: "accepted" as const },
    { purpose: "offer_accepted", outcome: "accepted" as const },
    { purpose: "offer_declined", outcome: "declined" as const },
    { purpose: "offer_expired", outcome: "expired" as const },
  ];

  // Ensure pending_conversion app also reaches offer stage (accepted later for pending conv)
  const pendingConv = [...ctx.apps.values()].find((a) => a.purpose === "pending_conversion");
  const withdrawnApp = [...ctx.apps.values()].find((a) => a.purpose === "offer_withdrawn");

  let n = 0;
  for (const spec of need) {
    let app = [...ctx.apps.values()].find((a) => a.purpose === spec.purpose);
    if (!app) continue;

    // Promote to offer stage if needed
    try {
      await appSvc.moveToStage(ctx.session, {
        id: app.id,
        stage: RecruitmentPipelineStage.offer,
        note: "Ready for offer (demo)",
      });
    } catch {
      /* may already be terminal/rejected */
    }

    const existing = await ctx.prisma.offer.findFirst({
      where: { applicationId: app.id },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      ctx.offers.set(spec.purpose, { id: existing.id, purpose: spec.outcome });
      n += 1;
      continue;
    }

    const job = [...ctx.jobs.values()].find((j) => j.id === app!.jobId);
    const base = 1400000 + n * 100000;
    const joining = daysFromNow(21 + n);

    const { id } = await svc.createOffer(ctx.session, {
      applicationId: app.id,
      currency: "INR",
      baseSalary: base,
      variablePay: Math.round(base * 0.1),
      benefitsNotes: "Medical + learning stipend",
      proposedStartDate: iso(joining),
      expiresAt: iso(spec.outcome === "expired" ? daysAgo(2) : daysFromNow(7)),
      employmentType: "Full Time",
      department: job?.dept ?? "Engineering",
      location: job?.loc ?? "Hyderabad",
      grade: "L4",
      reportingManagerId: ctx.staff.get("hm_eng")!.id,
      joiningDate: iso(joining),
      ctc: Math.round(base * 1.12),
      salaryBreakdownJson: {
        basic: Math.round(base * 0.4),
        hra: Math.round(base * 0.2),
        special: Math.round(base * 0.4),
      },
      probationDays: 90,
      offerNotes: `Demo offer · ${spec.outcome}`,
    });

    await svc.sendOffer(ctx.session, {
      id,
      expiresAt: iso(spec.outcome === "expired" ? daysAgo(2) : daysFromNow(7)),
    });

    if (spec.outcome === "accepted") {
      await svc.acceptOffer(ctx.session, { id });
    } else if (spec.outcome === "declined") {
      await svc.declineOffer(ctx.session, { id, reason: "Accepted competing offer" });
    }

    ctx.offers.set(spec.purpose, { id, purpose: spec.outcome });
    n += 1;
  }

  // Withdrawn offer (edge case) — use offer_withdrawn app if present, else skip
  if (withdrawnApp && n < 6) {
    const existing = await ctx.prisma.offer.findFirst({
      where: { applicationId: withdrawnApp.id },
    });
    if (!existing) {
      try {
        await appSvc.moveToStage(ctx.session, {
          id: withdrawnApp.id,
          stage: RecruitmentPipelineStage.offer,
          note: "Offer track",
        });
        const job = [...ctx.jobs.values()].find((j) => j.id === withdrawnApp.jobId);
        const { id } = await svc.createOffer(ctx.session, {
          applicationId: withdrawnApp.id,
          currency: "INR",
          baseSalary: 1500000,
          employmentType: "Full Time",
          department: job?.dept ?? "Engineering",
          location: job?.loc ?? "Hyderabad",
          grade: "L4",
          joiningDate: iso(daysFromNow(30)),
          ctc: 1680000,
        });
        await svc.sendOffer(ctx.session, { id, expiresAt: iso(daysFromNow(5)) });
        await svc.withdrawOffer(ctx.session, { id, reason: "Headcount frozen" });
        ctx.offers.set("offer_withdrawn", { id, purpose: "withdrawn" });
        n += 1;
      } catch (err) {
        log(`  withdraw skip: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Pending conversion: accept offer on pending_conversion app (do not convert yet)
  if (pendingConv) {
    const existing = await ctx.prisma.offer.findFirst({
      where: { applicationId: pendingConv.id },
    });
    if (!existing) {
      try {
        await appSvc.moveToStage(ctx.session, {
          id: pendingConv.id,
          stage: RecruitmentPipelineStage.offer,
          note: "Pending conversion track",
        });
        const job = [...ctx.jobs.values()].find((j) => j.id === pendingConv.jobId);
        const { id } = await svc.createOffer(ctx.session, {
          applicationId: pendingConv.id,
          currency: "INR",
          baseSalary: 1600000,
          employmentType: "Full Time",
          department: job?.dept ?? "Finance",
          location: job?.loc ?? "Hyderabad",
          grade: "L4",
          joiningDate: iso(daysFromNow(14)),
          ctc: 1792000,
        });
        await svc.sendOffer(ctx.session, { id, expiresAt: iso(daysFromNow(10)) });
        await svc.acceptOffer(ctx.session, { id });
        ctx.offers.set("pending_conversion", { id, purpose: "pending_conversion" });
        n += 1;
      } catch (err) {
        log(`  pending conv skip: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      ctx.offers.set("pending_conversion", {
        id: existing.id,
        purpose: "pending_conversion",
      });
    }
  }

  ctx.counts.offers = ctx.offers.size;
  log(`  offers mapped=${ctx.offers.size}`);
}
