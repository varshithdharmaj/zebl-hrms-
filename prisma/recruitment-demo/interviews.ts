import {
  InterviewRoundType,
  InterviewStatus,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import { addHours, daysAgo, daysFromNow, iso, log, type DemoCtx } from "./helpers";

type Spec = {
  purposeMatch: string;
  round: InterviewRoundType;
  status: InterviewStatus;
  rec?: string;
  panel: string;
};

const SPECS: Spec[] = [
  { purposeMatch: "technical", round: InterviewRoundType.technical, status: InterviewStatus.scheduled, panel: "iv_tech" },
  { purposeMatch: "technical", round: InterviewRoundType.technical, status: InterviewStatus.completed, rec: "strong_hire", panel: "iv_tech" },
  { purposeMatch: "hr", round: InterviewRoundType.hr, status: InterviewStatus.completed, rec: "hire", panel: "iv_hr" },
  { purposeMatch: "manager", round: InterviewRoundType.manager, status: InterviewStatus.completed, rec: "lean_hire", panel: "hm_eng" },
  { purposeMatch: "offer", round: InterviewRoundType.client, status: InterviewStatus.completed, rec: "no_hire", panel: "hm_sales" },
  { purposeMatch: "assessment", round: InterviewRoundType.technical, status: InterviewStatus.cancelled, panel: "iv_tech" },
  { purposeMatch: "screening", round: InterviewRoundType.screening, status: InterviewStatus.no_show, panel: "iv_hr" },
  { purposeMatch: "offer_declined", round: InterviewRoundType.technical, status: InterviewStatus.completed, rec: "strong_no_hire", panel: "iv_tech" },
];

export async function seedInterviews(ctx: DemoCtx): Promise<void> {
  log("Interviews (8) via InterviewService…");
  const svc = createInterviewService();
  const apps = [...ctx.apps.values()];
  let n = 0;

  for (const spec of SPECS) {
    const app =
      apps.find((a) => a.purpose === spec.purposeMatch) ??
      apps.find((a) =>
        [
          RecruitmentPipelineStage.technical_round,
          RecruitmentPipelineStage.screening,
          RecruitmentPipelineStage.offer,
          RecruitmentPipelineStage.manager_round,
          RecruitmentPipelineStage.hr_round,
          RecruitmentPipelineStage.assessment,
        ].includes(
          // purpose string fallback
          a.purpose as never
        )
      ) ??
      apps[n % apps.length];
    if (!app) continue;

    const existing = await ctx.prisma.interview.findFirst({
      where: {
        applicationId: app.id,
        roundType: spec.round,
        deletedAt: null,
      },
    });
    if (existing) {
      ctx.interviews.push(existing.id);
      n += 1;
      continue;
    }

    const start =
      spec.status === InterviewStatus.scheduled
        ? daysFromNow(3, 11)
        : daysAgo(6 + n, 11);
    const panel = ctx.staff.get(spec.panel)!;

    const createStatus =
      spec.status === InterviewStatus.completed ||
      spec.status === InterviewStatus.cancelled ||
      spec.status === InterviewStatus.no_show
        ? InterviewStatus.scheduled
        : spec.status;

    const { id } = await svc.createInterview(ctx.session, {
      applicationId: app.id,
      roundType: spec.round,
      status: createStatus,
      title: `${spec.round} interview (demo)`,
      scheduledStart: iso(start),
      scheduledEnd: iso(addHours(start, 1)),
      timezone: "Asia/Kolkata",
      location: "Teams",
      meetingUrl: `https://meet.zebl.demo/${app.id.slice(0, 6)}`,
      panelistEmployeeIds: [panel.id],
    });

    if (spec.status === InterviewStatus.completed) {
      await svc.completeInterview(ctx.session, id);
      const rating =
        spec.rec === "strong_hire"
          ? 5
          : spec.rec === "hire"
            ? 4
            : spec.rec === "lean_hire"
              ? 3.5
              : spec.rec === "no_hire"
                ? 2.5
                : 1.5;
      await svc.submitFeedback(ctx.session, {
        interviewId: id,
        overallRating: rating,
        recommendation: spec.rec ?? "hire",
        strengths: "Clear ownership and structured thinking.",
        concerns: (spec.rec ?? "").includes("no_hire")
          ? "Gaps vs bar for this level."
          : undefined,
        ratingsJson: { technical: rating, communication: rating - 0.2 },
      });
    } else if (spec.status === InterviewStatus.cancelled) {
      await svc.cancelInterview(ctx.session, id);
    } else if (spec.status === InterviewStatus.no_show) {
      await svc.updateInterview(ctx.session, {
        id,
        status: InterviewStatus.no_show,
      });
    }

    ctx.interviews.push(id);
    n += 1;
  }

  ctx.counts.interviews = n;
}
