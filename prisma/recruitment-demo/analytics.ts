import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  SavedFilterEntity,
} from "@/generated/prisma/enums";
import { daysAgo, log, type DemoCtx } from "./helpers";

/** Notifications + saved filters so analytics/report UX is populated. */
export async function seedAnalytics(ctx: DemoCtx): Promise<void> {
  log("Analytics support (notifications + filters)…");

  await ctx.prisma.notification.deleteMany({
    where: { correlationId: { startsWith: "min-demo:" } },
  });

  const recipients = [
    ctx.staff.get("hr_head")!.email,
    ctx.staff.get("rec_1")!.email,
    ctx.staff.get("hm_eng")!.email,
  ];

  const specs = [
    NotificationType.recruitment_interview_scheduled,
    NotificationType.recruitment_offer_released,
    NotificationType.recruitment_stage_changed,
    NotificationType.recruitment_converted,
    NotificationType.recruitment_sla_stale,
  ];

  let n = 0;
  for (let i = 0; i < specs.length; i++) {
    await ctx.prisma.notification.create({
      data: {
        type: specs[i]!,
        channel: NotificationChannel.email,
        recipient: recipients[i % recipients.length]!,
        subject: `Demo notification ${i + 1}`,
        payload: JSON.stringify({ minDemo: true }),
        status:
          i % 2 === 0
            ? NotificationDeliveryStatus.sent
            : NotificationDeliveryStatus.pending,
        correlationId: `min-demo:n${i + 1}`,
        scheduledAt: daysAgo(i + 1, 9),
        sentAt: i % 2 === 0 ? daysAgo(i + 1, 10) : null,
      },
    });
    n += 1;
  }

  for (const key of ["hr_head", "rec_1"] as const) {
    const u = ctx.staff.get(key)!;
    await ctx.prisma.recruitmentSavedFilter.deleteMany({
      where: { userId: u.userId, name: { startsWith: "MIN ·" } },
    });
    await ctx.prisma.recruitmentSavedFilter.createMany({
      data: [
        {
          userId: u.userId,
          entity: SavedFilterEntity.applications,
          name: "MIN · Active pipeline",
          filterJson: { status: "active" },
          isDefault: true,
        },
        {
          userId: u.userId,
          entity: SavedFilterEntity.candidates,
          name: "MIN · LinkedIn",
          filterJson: { tags: ["source:linkedin"] },
          isDefault: false,
        },
      ],
    });
  }

  ctx.counts.notifications = n;
}
