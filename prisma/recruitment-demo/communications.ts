import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
} from "@/generated/prisma/enums";
import { createCommunicationService } from "@/lib/recruitment/services/communication-service";
import { daysAgo, daysFromNow, iso, log, type DemoCtx } from "./helpers";

const TEMPLATES = [
  {
    key: "invite",
    name: "MIN · Interview Invitation",
    type: RecruitmentEmailTemplateType.interview_invitation,
    subject: "Interview Invitation — ZEBL",
    body: "Hi {{name}},\n\nInterview invite for {{job}}.\n\nTalent Team",
  },
  {
    key: "offer",
    name: "MIN · Offer Letter",
    type: RecruitmentEmailTemplateType.offer_letter,
    subject: "Offer of Employment — ZEBL",
    body: "Dear {{name}},\n\nPlease find your offer.\n\nHR",
  },
  {
    key: "reject",
    name: "MIN · Rejection",
    type: RecruitmentEmailTemplateType.rejection,
    subject: "Application update",
    body: "Hi {{name}},\n\nWe will not move forward at this time.\n\nTalent",
  },
  {
    key: "welcome",
    name: "MIN · Welcome",
    type: RecruitmentEmailTemplateType.welcome,
    subject: "Welcome to ZEBL",
    body: "Hi {{name}},\n\nWelcome aboard!\n\nPeople Team",
  },
  {
    key: "remind",
    name: "MIN · Reminder",
    type: RecruitmentEmailTemplateType.interview_reminder,
    subject: "Interview reminder",
    body: "Hi {{name}},\n\nReminder about your interview.\n\nTalent",
  },
] as const;

export async function seedCommunications(ctx: DemoCtx): Promise<void> {
  log("Communications (~20) via CommunicationService…");
  const svc = createCommunicationService();

  for (const t of TEMPLATES) {
    const existing = await ctx.prisma.recruitmentEmailTemplate.findFirst({
      where: { name: t.name, deletedAt: null },
    });
    if (existing) {
      ctx.templates.set(t.key, existing.id);
      continue;
    }
    const { id } = await svc.createEmailTemplate(ctx.session, {
      name: t.name,
      type: t.type,
      subject: t.subject,
      body: t.body,
    });
    ctx.templates.set(t.key, id);
  }

  const list = [...ctx.candidates.values()].slice(0, 8);
  let n = 0;

  for (let i = 0; i < list.length && n < 20; i++) {
    const cand = list[i]!;
    const app = [...ctx.apps.values()].find((a) => a.candidateId === cand.id);
    const job = app
      ? [...ctx.jobs.values()].find((j) => j.id === app.jobId)
      : undefined;

    // Sent + received reply thread
    const { id: sentId } = await svc.createDraft(ctx.session, {
      type: RecruitmentCommunicationType.email_sent,
      subject: `Application received — ${job?.title ?? "Role"}`,
      body: `Hi ${cand.name},\n\nWe received your application.\n\nTalent`,
      candidateId: cand.id,
      applicationId: app?.id,
      jobOpeningId: app?.jobId,
      recipientEmail: cand.email,
      templateId: ctx.templates.get("welcome") ?? null,
      metadata: { minDemo: true, folder: "sent" },
    });
    await ctx.prisma.recruitmentCommunication.update({
      where: { id: sentId },
      data: {
        status: RecruitmentCommunicationStatus.delivered,
        sentAt: daysAgo(15 - i, 10),
        deliveredAt: daysAgo(15 - i, 10),
        threadId: `min-thread-${cand.id}`,
      },
    });
    n += 1;

    await ctx.prisma.recruitmentCommunication.create({
      data: {
        type: RecruitmentCommunicationType.email_received,
        status: RecruitmentCommunicationStatus.delivered,
        subject: `Re: Application received — ${job?.title ?? "Role"}`,
        body: `Thanks — I am available this week.\n\n${cand.name}`,
        candidateId: cand.id,
        applicationId: app?.id,
        jobOpeningId: app?.jobId,
        recipientEmail: ctx.session.email,
        parentId: sentId,
        threadId: `min-thread-${cand.id}`,
        sentAt: daysAgo(14 - i, 16),
        deliveredAt: daysAgo(14 - i, 16),
        metadata: { minDemo: true, folder: "inbox" },
      },
    });
    n += 1;
  }

  // Draft
  const c0 = list[0];
  if (c0 && n < 20) {
    await svc.createDraft(ctx.session, {
      subject: `Draft follow-up — ${c0.name}`,
      body: `Hi ${c0.name},\n\nDraft only.\n\nRecruiter`,
      candidateId: c0.id,
      recipientEmail: c0.email,
      metadata: { minDemo: true, folder: "drafts" },
    });
    n += 1;
  }

  // Scheduled reminder
  if (c0 && n < 20) {
    const { id } = await svc.createDraft(ctx.session, {
      type: RecruitmentCommunicationType.interview_reminder,
      subject: "Interview reminder",
      body: `Hi ${c0.name},\n\nReminder about tomorrow.\n\nTalent`,
      candidateId: c0.id,
      recipientEmail: c0.email,
      templateId: ctx.templates.get("remind") ?? null,
      interviewId: ctx.interviews[0],
      metadata: { minDemo: true, folder: "scheduled" },
    });
    await svc.scheduleMessage(ctx.session, {
      id,
      scheduledFor: iso(daysFromNow(1, 8)),
    });
    n += 1;
  }

  // Interview invitation + attachment
  if (ctx.interviews[0] && n < 20) {
    const iv = await ctx.prisma.interview.findUnique({
      where: { id: ctx.interviews[0] },
      include: { application: { include: { candidate: true, jobOpening: true } } },
    });
    if (iv) {
      const { id } = await svc.createDraft(ctx.session, {
        type: RecruitmentCommunicationType.interview_invitation,
        subject: `Interview — ${iv.application.jobOpening.title}`,
        body: `Hi ${iv.application.candidate.fullName},\n\nYou are invited.\n\nTalent`,
        candidateId: iv.application.candidateId,
        applicationId: iv.applicationId,
        jobOpeningId: iv.application.jobOpeningId,
        interviewId: iv.id,
        recipientEmail: iv.application.candidate.email ?? undefined,
        templateId: ctx.templates.get("invite") ?? null,
        metadata: { minDemo: true },
      });
      await ctx.prisma.recruitmentCommunication.update({
        where: { id },
        data: {
          status: RecruitmentCommunicationStatus.sent,
          sentAt: daysAgo(2, 12),
        },
      });
      await ctx.prisma.recruitmentCommunicationAttachment.create({
        data: {
          communicationId: id,
          fileName: "agenda.pdf",
          fileType: "application/pdf",
          fileSize: 24000,
          storagePath: `demo/min/comms/${id}/agenda.pdf`,
        },
      });
      n += 1;
    }
  }

  // Offer / rejection / welcome samples
  for (const [purpose, tpl, type] of [
    ["hired", "offer", RecruitmentCommunicationType.offer_letter],
    ["rejected", "reject", RecruitmentCommunicationType.rejection],
    ["offer_accepted", "welcome", RecruitmentCommunicationType.email_sent],
  ] as const) {
    if (n >= 20) break;
    const app = [...ctx.apps.values()].find((a) => a.purpose === purpose);
    if (!app) continue;
    const cand = [...ctx.candidates.values()].find((c) => c.id === app.candidateId);
    if (!cand) continue;
    const { id } = await svc.createDraft(ctx.session, {
      type,
      subject: `${tpl} — ${cand.name}`,
      body: `Hi ${cand.name},\n\nDemo ${tpl} message.\n\nZEBL`,
      candidateId: cand.id,
      applicationId: app.id,
      jobOpeningId: app.jobId,
      recipientEmail: cand.email,
      templateId: ctx.templates.get(tpl) ?? null,
      metadata: { minDemo: true },
    });
    await ctx.prisma.recruitmentCommunication.update({
      where: { id },
      data: {
        status: RecruitmentCommunicationStatus.delivered,
        sentAt: daysAgo(4, 11),
        deliveredAt: daysAgo(4, 11),
      },
    });
    n += 1;
  }

  ctx.counts.communications = n;
  ctx.counts.templates = TEMPLATES.length;
}
