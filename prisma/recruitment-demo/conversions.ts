import { OfferStatus } from "@/generated/prisma/enums";
import { createEmployeeConversionService } from "@/lib/recruitment/services/employee-conversion-service";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { DEMO_PASSWORD, MIN_EMAIL_DOMAIN, MIN_PREFIX } from "./catalog";
import { iso, log, type DemoCtx } from "./helpers";

/** Convert exactly 2 accepted offers; leave pending_conversion untouched. */
export async function seedConversions(ctx: DemoCtx): Promise<void> {
  log("Conversions (2) via EmployeeConversionService…");
  const conv = createEmployeeConversionService();
  const apps = createApplicationService();

  const targets = ["hired", "offer_accepted"] as const;
  let n = 0;

  for (const purpose of targets) {
    const ref = ctx.offers.get(purpose);
    if (!ref) continue;

    const existing = await ctx.prisma.employeeConversionSnapshot.findUnique({
      where: { offerId: ref.id },
    });
    if (existing) {
      n += 1;
      continue;
    }

    const offer = await ctx.prisma.offer.findUnique({
      where: { id: ref.id },
      include: {
        application: { include: { candidate: true, jobOpening: true } },
      },
    });
    if (!offer || offer.status !== OfferStatus.accepted) continue;

    const cand = offer.application.candidate;
    const job = offer.application.jobOpening;
    const code = `${MIN_PREFIX}HIRE-0${n + 1}`;

    const prior = await ctx.prisma.employee.findUnique({ where: { employeeCode: code } });
    if (prior) {
      n += 1;
      continue;
    }

    try {
      await conv.convertEmployee(ctx.session, {
        offerId: offer.id,
        employeeCode: code,
        name: cand.fullName,
        email: `hire${n + 1}@${MIN_EMAIL_DOMAIN}`,
        phone: cand.phone,
        department: offer.department ?? job.department ?? "Engineering",
        designation: job.title,
        employmentType: offer.employmentType ?? "Full Time",
        workLocation: offer.location ?? job.location ?? "Hyderabad",
        joiningDate: iso(offer.joiningDate ?? new Date()),
        grade: offer.grade ?? "L4",
        ctc: Number(offer.ctc ?? offer.baseSalary),
        managerId: offer.reportingManagerId ?? ctx.staff.get("hm_eng")!.id,
        createLogin: n === 0,
        password: DEMO_PASSWORD,
      });
      try {
        await apps.hireCandidate(ctx.session, offer.applicationId);
      } catch {
        /* ok */
      }
      n += 1;
    } catch (err) {
      log(`  skip ${purpose}: ${err instanceof Error ? err.message : err}`);
    }
  }

  ctx.counts.conversions = n;
  ctx.counts.pendingConversion = ctx.offers.has("pending_conversion") ? 1 : 0;
}
