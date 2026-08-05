import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { daysAgo, log, type DemoCtx } from "./helpers";

/** Fill any timeline gaps; services already emit most workflow events. */
export async function seedTimeline(ctx: DemoCtx): Promise<void> {
  log("Timeline enrichment…");
  let n = 0;
  for (const c of ctx.candidates.values()) {
    const exists = await ctx.prisma.recruitmentTimelineEvent.count({
      where: { candidateId: c.id, eventType: "demo.profile_ready" },
    });
    if (exists) continue;
    await RecruitmentTimelineService.append({
      entityType: "candidate",
      entityId: c.id,
      candidateId: c.id,
      eventType: "demo.profile_ready",
      summary: `Profile ready for ${c.name}`,
      actorUserId: ctx.session.id,
      metadata: { minDemo: true },
    });
    await ctx.prisma.recruitmentTimelineEvent.updateMany({
      where: { candidateId: c.id, eventType: "demo.profile_ready" },
      data: { createdAt: daysAgo(10, 13) },
    });
    n += 1;
  }
  ctx.counts.timelineExtra = n;
}
