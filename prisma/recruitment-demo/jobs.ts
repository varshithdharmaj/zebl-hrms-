import { JobEmploymentType, JobOpeningStatus } from "@/generated/prisma/enums";
import { JobOpeningService } from "@/lib/recruitment/job/job-opening-service";
import { JOBS } from "./catalog";
import { daysFromNow, iso, log, type DemoCtx } from "./helpers";

export async function seedJobs(ctx: DemoCtx): Promise<void> {
  log("Jobs (6) via JobOpeningService…");

  for (const j of JOBS) {
    const existing = await ctx.prisma.jobOpening.findUnique({ where: { code: j.code } });
    if (existing) {
      if (existing.deletedAt) {
        await ctx.prisma.jobOpening.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
      }
      ctx.jobs.set(j.code, {
        id: existing.id,
        title: j.title,
        dept: j.dept,
        loc: j.loc,
      });
      continue;
    }

    const publish = j.status !== "draft";
    const { jobId } = await JobOpeningService.create(ctx.session, {
      title: j.title,
      code: j.code,
      department: j.dept,
      location: j.loc,
      workMode: j.loc === "Remote" ? "remote" : "hybrid",
      employmentType: JobEmploymentType.full_time,
      description: `${j.title} at ZEBL Technologies — ${j.dept}. Own outcomes, collaborate tightly, raise the bar.`,
      requirements: `Relevant experience for ${j.title}. Clear communication.`,
      skills: j.dept === "Engineering" ? "TypeScript, Node.js, SQL" : "Domain expertise",
      openingsCount: 1,
      headcountApproved: true,
      compensationCurrency: "INR",
      compensationMin: String(j.min),
      compensationMax: String(j.max),
      targetStartDate: iso(daysFromNow(30)),
      ownerRecruiterUserId: ctx.staff.get(j.rec)!.userId,
      hiringManagerEmployeeId: ctx.staff.get(j.hm)!.id,
      recruiterEmployeeId: ctx.staff.get(j.rec)!.id,
      publish,
    });

    if (j.status === "on_hold") {
      await JobOpeningService.changeStatus(
        ctx.session,
        jobId,
        JobOpeningStatus.on_hold,
        "Headcount freeze (demo)"
      );
    } else if (j.status === "closed") {
      await JobOpeningService.changeStatus(
        ctx.session,
        jobId,
        JobOpeningStatus.closed,
        "Role cancelled (demo)"
      );
    } else if (j.status === "filled") {
      await JobOpeningService.changeStatus(
        ctx.session,
        jobId,
        JobOpeningStatus.filled,
        "Position filled (demo)"
      );
    }

    ctx.jobs.set(j.code, { id: jobId, title: j.title, dept: j.dept, loc: j.loc });
  }

  ctx.counts.jobs = JOBS.length;
}
