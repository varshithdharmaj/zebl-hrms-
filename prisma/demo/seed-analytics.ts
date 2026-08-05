import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  RecruitmentTimelineEntityType,
  SavedFilterEntity,
} from "@/generated/prisma/client";
import type { DemoSeedContext } from "./context";
import { daysAgo, logStep } from "./helpers";

/**
 * Populate metric snapshots, saved filters, and demo notifications.
 * Live analytics primarily compute from transactional data; snapshots support trend widgets.
 */
export async function seedAnalytics(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding analytics snapshots + notifications…");
  const { prisma, actors, applications, offers, interviews, jobs, candidates } = ctx;

  await prisma.recruitmentMetricSnapshot.deleteMany({
    where: { scopeKey: { startsWith: "demo:" } },
  });

  const now = new Date();
  const periods: Array<{ start: Date; end: Date; label: string }> = [];
  for (let w = 11; w >= 0; w--) {
    const end = daysAgo(w * 7, 23);
    const start = daysAgo(w * 7 + 6, 0);
    periods.push({ start, end, label: `w-${w}` });
  }

  const appsByWeek = periods.map((p, idx) => {
    const count = applications.filter(
      (a) => a.createdAt >= p.start && a.createdAt <= p.end
    ).length;
    return Math.max(count, 8 + ((idx * 5) % 17));
  });

  const hiresByWeek = periods.map((p, idx) => {
    const count = offers.filter(
      (o) => o.accepted && o.joiningDate >= p.start && o.joiningDate <= p.end
    ).length;
    return Math.max(count, idx % 4);
  });

  let snapshotCount = 0;
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i]!;
    const rows = [
      {
        metricKey: "applications_created",
        scopeType: "org",
        scopeKey: "demo:org",
        value: appsByWeek[i]!,
        payloadJson: { week: p.label },
      },
      {
        metricKey: "hires_completed",
        scopeType: "org",
        scopeKey: "demo:org",
        value: hiresByWeek[i]!,
        payloadJson: { week: p.label },
      },
      {
        metricKey: "offer_acceptance_rate",
        scopeType: "org",
        scopeKey: "demo:org",
        value: 55 + (i % 20),
        payloadJson: { unit: "percent" },
      },
      {
        metricKey: "avg_time_to_hire_days",
        scopeType: "org",
        scopeKey: "demo:org",
        value: 28 + (i % 10),
        payloadJson: { unit: "days" },
      },
      {
        metricKey: "pipeline_aging_gt_14d",
        scopeType: "org",
        scopeKey: "demo:org",
        value: 12 + (i % 8),
        payloadJson: { unit: "applications" },
      },
      {
        metricKey: "communications_sent",
        scopeType: "org",
        scopeKey: "demo:org",
        value: 40 + i * 3,
        payloadJson: { unit: "messages" },
      },
    ];

    for (const row of rows) {
      await prisma.recruitmentMetricSnapshot.create({
        data: {
          metricKey: row.metricKey,
          scopeType: row.scopeType,
          scopeKey: row.scopeKey,
          periodStart: p.start,
          periodEnd: p.end,
          value: row.value,
          payloadJson: row.payloadJson,
          computedAt: now,
        },
      });
      snapshotCount += 1;
    }
  }

  // Recruiter-scoped metrics
  for (const rec of [actors.recruiter1, actors.recruiter2]) {
    const ownedApps = applications.filter((a) => a.assignedRecruiterUserId === rec.userId).length;
    const ownedOffers = offers.filter((o) => {
      const app = applications.find((a) => a.id === o.applicationId);
      return app?.assignedRecruiterUserId === rec.userId;
    }).length;
    await prisma.recruitmentMetricSnapshot.create({
      data: {
        metricKey: "recruiter_applications",
        scopeType: "recruiter",
        scopeKey: `demo:recruiter:${rec.userId}`,
        periodStart: daysAgo(30, 0),
        periodEnd: now,
        value: ownedApps,
        payloadJson: { email: rec.email },
      },
    });
    await prisma.recruitmentMetricSnapshot.create({
      data: {
        metricKey: "recruiter_offers",
        scopeType: "recruiter",
        scopeKey: `demo:recruiter:${rec.userId}`,
        periodStart: daysAgo(30, 0),
        periodEnd: now,
        value: ownedOffers,
        payloadJson: { email: rec.email },
      },
    });
    snapshotCount += 2;
  }

  // Department metrics
  const depts = [...new Set(jobs.map((j) => j.department))];
  for (const dept of depts) {
    const deptJobs = jobs.filter((j) => j.department === dept).map((j) => j.id);
    const deptApps = applications.filter((a) => deptJobs.includes(a.jobOpeningId)).length;
    await prisma.recruitmentMetricSnapshot.create({
      data: {
        metricKey: "department_applications",
        scopeType: "department",
        scopeKey: `demo:dept:${dept}`,
        periodStart: daysAgo(90, 0),
        periodEnd: now,
        value: deptApps,
        payloadJson: { department: dept },
      },
    });
    snapshotCount += 1;
  }

  // Saved filters for reports UX
  for (const user of [actors.hr_manager, actors.recruiter1, actors.super_admin]) {
    await prisma.recruitmentSavedFilter.deleteMany({
      where: { userId: user.userId, name: { startsWith: "Demo ·" } },
    });
    await prisma.recruitmentSavedFilter.createMany({
      data: [
        {
          userId: user.userId,
          entity: SavedFilterEntity.applications,
          name: "Demo · Active pipeline",
          filterJson: { status: "active", stages: ["screening", "technical_round", "offer"] },
          isDefault: false,
        },
        {
          userId: user.userId,
          entity: SavedFilterEntity.jobs,
          name: "Demo · Open engineering roles",
          filterJson: { status: "open", departments: ["Engineering", "QA", "Product"] },
          isDefault: true,
        },
        {
          userId: user.userId,
          entity: SavedFilterEntity.candidates,
          name: "Demo · LinkedIn sourced",
          filterJson: { tags: ["source:linkedin"] },
          isDefault: false,
        },
      ],
    });
  }

  // Demo notifications for recruiters / HR
  await prisma.notification.deleteMany({
    where: { correlationId: { startsWith: "demo-seed:" } },
  });

  const notifSpecs: Array<{
    type: NotificationType;
    recipient: string;
    subject: string;
    payload: Record<string, unknown>;
  }> = [
    {
      type: NotificationType.recruitment_interview_scheduled,
      recipient: actors.recruiter1.email,
      subject: "Interview scheduled — Senior Backend Engineer",
      payload: { count: interviews.filter((i) => i.status === "scheduled").length },
    },
    {
      type: NotificationType.recruitment_offer_approval,
      recipient: actors.hr_manager.email,
      subject: "Offer awaiting HR approval",
      payload: { pending: offers.filter((o) => o.status === "hr_approval").length },
    },
    {
      type: NotificationType.recruitment_offer_released,
      recipient: actors.recruiter2.email,
      subject: "Offer released to candidate",
      payload: {},
    },
    {
      type: NotificationType.recruitment_stage_changed,
      recipient: actors.recruiter1.email,
      subject: "Application moved to Technical Round",
      payload: {},
    },
    {
      type: NotificationType.recruitment_decision_pending,
      recipient: actors.eng_manager.email,
      subject: "Hiring decision pending",
      payload: {},
    },
    {
      type: NotificationType.recruitment_sla_stale,
      recipient: actors.hr_manager.email,
      subject: "SLA breach: applications stuck >14 days",
      payload: {
        stuck: applications.filter((a) => a.currentStage === "technical_round").length,
      },
    },
    {
      type: NotificationType.recruitment_converted,
      recipient: actors.hr_manager.email,
      subject: "Candidate converted to employee",
      payload: {},
    },
    {
      type: NotificationType.recruitment_duplicate_found,
      recipient: actors.recruiter2.email,
      subject: "Possible duplicate candidate detected",
      payload: {},
    },
    {
      type: NotificationType.recruitment_mention,
      recipient: actors.hiring_manager.email,
      subject: "You were mentioned on a candidate note",
      payload: {},
    },
    {
      type: NotificationType.recruitment_parse_ready,
      recipient: actors.recruiter1.email,
      subject: "Resume parse ready for review",
      payload: { candidates: candidates.length },
    },
  ];

  let notifCount = 0;
  for (let i = 0; i < notifSpecs.length; i++) {
    const n = notifSpecs[i]!;
    await prisma.notification.create({
      data: {
        type: n.type,
        channel: NotificationChannel.email,
        recipient: n.recipient,
        subject: n.subject,
        payload: JSON.stringify(n.payload),
        status:
          i % 3 === 0
            ? NotificationDeliveryStatus.pending
            : NotificationDeliveryStatus.sent,
        attempts: i % 3 === 0 ? 0 : 1,
        correlationId: `demo-seed:notif-${i + 1}`,
        scheduledAt: daysAgo(i, 9),
        sentAt: i % 3 === 0 ? null : daysAgo(i, 10),
      },
    });
    notifCount += 1;
  }

  // Enrich candidate timelines: profile + document events
  const sampleCandidates = candidates;
  let timelineExtra = 0;
  for (const cand of sampleCandidates) {
    await prisma.recruitmentTimelineEvent.create({
      data: {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: cand.id,
        candidateId: cand.id,
        eventType: "candidate.profile_updated",
        summary: `Profile enriched for ${cand.fullName}`,
        actorUserId: cand.primaryRecruiterUserId,
        metadata: { demoSeed: "zebl-demo-seed-v1" },
        createdAt: daysAgo(15 + (cand.index % 40), 13),
      },
    });
    await prisma.recruitmentTimelineEvent.create({
      data: {
        entityType: RecruitmentTimelineEntityType.candidate,
        entityId: cand.id,
        candidateId: cand.id,
        eventType: "document.uploaded",
        summary: "Resume uploaded",
        actorUserId: cand.primaryRecruiterUserId,
        metadata: { demoSeed: "zebl-demo-seed-v1", documentType: "resume" },
        createdAt: daysAgo(14 + (cand.index % 40), 14),
      },
    });
    timelineExtra += 2;
  }

  ctx.counts.metricSnapshots = snapshotCount;
  ctx.counts.notifications = notifCount;
  ctx.counts.timelineExtra = timelineExtra;
  logStep(
    `Analytics ready (snapshots=${snapshotCount}, notifications=${notifCount}, timeline+=${timelineExtra}).`
  );
}
