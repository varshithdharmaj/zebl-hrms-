import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
  RecruitmentEmailTemplateType,
  RecruitmentTimelineEntityType,
} from "@/generated/prisma/client";
import { EMAIL_TEMPLATES } from "./constants";
import type { DemoSeedContext, DemoTemplateRef } from "./context";
import {
  addDays,
  chunk,
  daysAgo,
  daysFromNow,
  demoMeta,
  logStep,
} from "./helpers";

export async function seedCommunications(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding email templates + communications…");
  const { prisma, rng, actors, candidates, applications, interviews, offers, jobs } = ctx;
  const templates: DemoTemplateRef[] = [];

  for (const tpl of EMAIL_TEMPLATES) {
    const existing = await prisma.recruitmentEmailTemplate.findFirst({
      where: { name: tpl.name, deletedAt: null },
    });
    const row = existing
      ? await prisma.recruitmentEmailTemplate.update({
          where: { id: existing.id },
          data: {
            type: tpl.type as RecruitmentEmailTemplateType,
            subject: tpl.subject,
            body: tpl.body,
            isSystem: false,
            isActive: true,
            deletedAt: null,
          },
        })
      : await prisma.recruitmentEmailTemplate.create({
          data: {
            name: tpl.name,
            type: tpl.type as RecruitmentEmailTemplateType,
            subject: tpl.subject,
            body: tpl.body,
            isSystem: false,
            isActive: true,
            createdByUserId: actors.hr_manager.userId,
          },
        });
    templates.push({ key: tpl.key, id: row.id, type: tpl.type });
  }
  ctx.templates = templates;

  const templateByKey = Object.fromEntries(templates.map((t) => [t.key, t]));
  let created = 0;
  let attachments = 0;

  // Per-candidate communication mix
  for (const batch of chunk(candidates, 20)) {
    await prisma.$transaction(async (tx) => {
      for (const cand of batch) {
        const apps = applications.filter((a) => a.candidateId === cand.id);
        const app = apps[0];
        const job = app ? jobs.find((j) => j.id === app.jobOpeningId) : undefined;
        const sender = actors.recruiter1.userId;
        const jobTitle = job?.title ?? "Open Role";

        const render = (body: string) =>
          body
            .replaceAll("{{candidate_name}}", cand.fullName)
            .replaceAll("{{job_title}}", jobTitle)
            .replaceAll("{{message_body}}", "Please find an update regarding your application.");

        // Application received (sent)
        const receivedTpl = templateByKey.app_received!;
        const threadId = `demo-thread-${cand.id}`;
        const root = await tx.recruitmentCommunication.create({
          data: {
            type: RecruitmentCommunicationType.email_sent,
            status: RecruitmentCommunicationStatus.delivered,
            subject: render(EMAIL_TEMPLATES.find((t) => t.key === "app_received")!.subject),
            body: render(EMAIL_TEMPLATES.find((t) => t.key === "app_received")!.body),
            candidateId: cand.id,
            applicationId: app?.id,
            jobOpeningId: app?.jobOpeningId,
            templateId: receivedTpl.id,
            senderUserId: sender,
            recipientEmail: cand.email,
            threadId,
            sentAt: daysAgo(30 + (cand.index % 20), 10),
            deliveredAt: daysAgo(30 + (cand.index % 20), 10),
            metadata: demoMeta({ folder: "sent", templateKey: "app_received" }),
            createdAt: daysAgo(30 + (cand.index % 20), 10),
          },
        });
        created += 1;

        // Candidate reply (inbox / email_received)
        const reply = await tx.recruitmentCommunication.create({
          data: {
            type: RecruitmentCommunicationType.email_received,
            status: RecruitmentCommunicationStatus.delivered,
            subject: `Re: ${root.subject}`,
            body: `Hi,\n\nThank you for the update. I am available this week for next steps.\n\nRegards,\n${cand.fullName}`,
            candidateId: cand.id,
            applicationId: app?.id,
            jobOpeningId: app?.jobOpeningId,
            senderUserId: null,
            recipientEmail: actors.recruiter1.email,
            threadId,
            parentId: root.id,
            sentAt: daysAgo(28 + (cand.index % 20), 15),
            deliveredAt: daysAgo(28 + (cand.index % 20), 15),
            metadata: demoMeta({ folder: "inbox" }),
            createdAt: daysAgo(28 + (cand.index % 20), 15),
          },
        });
        created += 1;

        // Recruiter follow-up (thread)
        await tx.recruitmentCommunication.create({
          data: {
            type: RecruitmentCommunicationType.email_sent,
            status: RecruitmentCommunicationStatus.sent,
            subject: `Re: ${root.subject}`,
            body: `Hi ${cand.fullName},\n\nGlad to hear. We will share interview slots shortly.\n\n— ${actors.recruiter1.name}`,
            candidateId: cand.id,
            applicationId: app?.id,
            jobOpeningId: app?.jobOpeningId,
            senderUserId: sender,
            recipientEmail: cand.email,
            threadId,
            parentId: reply.id,
            sentAt: daysAgo(27 + (cand.index % 20), 11),
            metadata: demoMeta({ folder: "sent" }),
            createdAt: daysAgo(27 + (cand.index % 20), 11),
          },
        });
        created += 1;

        // Draft
        if (cand.index % 4 === 0) {
          await tx.recruitmentCommunication.create({
            data: {
              type: RecruitmentCommunicationType.email_sent,
              status: RecruitmentCommunicationStatus.draft,
              subject: `Follow-up draft — ${cand.fullName}`,
              body: render(EMAIL_TEMPLATES.find((t) => t.key === "general_hr")!.body),
              candidateId: cand.id,
              applicationId: app?.id,
              jobOpeningId: app?.jobOpeningId,
              templateId: templateByKey.general_hr!.id,
              senderUserId: sender,
              recipientEmail: cand.email,
              threadId: `demo-draft-${cand.id}`,
              metadata: demoMeta({ folder: "drafts" }),
              createdAt: daysAgo(2, 9),
            },
          });
          created += 1;
        }

        // Scheduled
        if (cand.index % 5 === 0) {
          await tx.recruitmentCommunication.create({
            data: {
              type: RecruitmentCommunicationType.interview_reminder,
              status: RecruitmentCommunicationStatus.scheduled,
              subject: render(EMAIL_TEMPLATES.find((t) => t.key === "interview_reminder")!.subject),
              body: render(EMAIL_TEMPLATES.find((t) => t.key === "interview_reminder")!.body),
              candidateId: cand.id,
              applicationId: app?.id,
              jobOpeningId: app?.jobOpeningId,
              templateId: templateByKey.interview_reminder!.id,
              senderUserId: actors.recruiter2.userId,
              recipientEmail: cand.email,
              scheduledFor: daysFromNow(1 + (cand.index % 3), 8),
              metadata: demoMeta({ folder: "scheduled" }),
              createdAt: daysAgo(1, 16),
            },
          });
          created += 1;
        }

        await tx.recruitmentTimelineEvent.create({
          data: {
            entityType: RecruitmentTimelineEntityType.candidate,
            entityId: cand.id,
            candidateId: cand.id,
            applicationId: app?.id,
            jobOpeningId: app?.jobOpeningId,
            eventType: "communication.sent",
            summary: `Application received email sent to ${cand.email}`,
            actorUserId: sender,
            metadata: demoMeta({ communicationId: root.id }),
            createdAt: root.createdAt,
          },
        });
      }
    });
  }

  // Interview invitations for scheduled interviews
  const scheduled = interviews.filter((i) => i.status === "scheduled").slice(0, 80);
  for (const batch of chunk(scheduled, 25)) {
    await prisma.$transaction(async (tx) => {
      for (const iv of batch) {
        const app = applications.find((a) => a.id === iv.applicationId);
        if (!app) continue;
        const cand = candidates.find((c) => c.id === app.candidateId);
        if (!cand) continue;
        const job = jobs.find((j) => j.id === app.jobOpeningId);
        const tpl = templateByKey.interview_invite!;
        const subject = `Interview Invitation — ${job?.title ?? "Role"} at ZEBL Technologies`;
        const body = `Hi ${cand.fullName},\n\nYou are invited for a ${iv.roundType} interview for ${job?.title ?? "the role"}.\n\nZEBL Talent Team`;

        const msg = await tx.recruitmentCommunication.create({
          data: {
            type: RecruitmentCommunicationType.interview_invitation,
            status: RecruitmentCommunicationStatus.delivered,
            subject,
            body,
            candidateId: cand.id,
            applicationId: app.id,
            jobOpeningId: app.jobOpeningId,
            interviewId: iv.id,
            templateId: tpl.id,
            senderUserId: app.assignedRecruiterUserId,
            recipientEmail: cand.email,
            threadId: `demo-iv-${iv.id}`,
            sentAt: daysAgo(3, 12),
            deliveredAt: daysAgo(3, 12),
            metadata: demoMeta({ folder: "sent", templateKey: "interview_invite" }),
          },
        });
        created += 1;

        await tx.recruitmentCommunicationAttachment.create({
          data: {
            communicationId: msg.id,
            fileName: "interview-agenda.pdf",
            fileType: "application/pdf",
            fileSize: 32_000,
            storagePath: `demo/communications/${msg.id}/interview-agenda.pdf`,
          },
        });
        attachments += 1;
      }
    });
  }

  // Offer letters + reminders
  const releasedOffers = offers.filter((o) =>
    ["released", "accepted", "declined", "withdrawn"].includes(o.status)
  );
  for (const batch of chunk(releasedOffers, 20)) {
    await prisma.$transaction(async (tx) => {
      for (const offer of batch) {
        const cand = candidates.find((c) => c.id === offer.candidateId);
        if (!cand) continue;
        const job = jobs.find((j) => j.id === offer.jobOpeningId);
        const tpl = templateByKey.offer_letter!;
        const msg = await tx.recruitmentCommunication.create({
          data: {
            type: RecruitmentCommunicationType.offer_letter,
            status: RecruitmentCommunicationStatus.delivered,
            subject: `Offer of Employment — ZEBL Technologies Pvt Ltd`,
            body: `Dear ${cand.fullName},\n\nPlease find your offer for ${job?.title ?? "the role"}.\n\nHR Team`,
            candidateId: cand.id,
            applicationId: offer.applicationId,
            jobOpeningId: offer.jobOpeningId,
            offerId: offer.id,
            templateId: tpl.id,
            senderUserId: actors.hr_manager.userId,
            recipientEmail: cand.email,
            threadId: `demo-offer-${offer.id}`,
            sentAt: daysAgo(6, 14),
            deliveredAt: daysAgo(6, 14),
            metadata: demoMeta({ folder: "sent", templateKey: "offer_letter" }),
          },
        });
        created += 1;

        await tx.recruitmentCommunicationAttachment.create({
          data: {
            communicationId: msg.id,
            fileName: "offer-letter.pdf",
            fileType: "application/pdf",
            fileSize: 128_000,
            storagePath: `demo/communications/${msg.id}/offer-letter.pdf`,
          },
        });
        attachments += 1;

        if (offer.status === "released") {
          await tx.recruitmentCommunication.create({
            data: {
              type: RecruitmentCommunicationType.email_sent,
              status: RecruitmentCommunicationStatus.sent,
              subject: "Reminder: Offer response pending",
              body: `Hi ${cand.fullName},\n\nFriendly reminder to respond to your ZEBL offer.\n\nHR Team`,
              candidateId: cand.id,
              applicationId: offer.applicationId,
              offerId: offer.id,
              templateId: templateByKey.offer_reminder!.id,
              senderUserId: actors.hr_manager.userId,
              recipientEmail: cand.email,
              threadId: `demo-offer-${offer.id}`,
              parentId: msg.id,
              sentAt: daysAgo(2, 10),
              metadata: demoMeta({ folder: "sent", forwarded: false }),
              createdAt: daysAgo(2, 10),
            },
          });
          created += 1;
        }

        // Forwarded internal note
        if (rng() > 0.6) {
          await tx.recruitmentCommunication.create({
            data: {
              type: RecruitmentCommunicationType.internal_note,
              status: RecruitmentCommunicationStatus.sent,
              subject: `Fwd: Offer thread — ${cand.fullName}`,
              body: `Forwarded to HM for visibility. Original offer thread attached in context.`,
              candidateId: cand.id,
              applicationId: offer.applicationId,
              offerId: offer.id,
              senderUserId: actors.recruiter1.userId,
              recipientEmail: actors.eng_manager.email,
              threadId: `demo-offer-fwd-${offer.id}`,
              metadata: demoMeta({ folder: "sent", forwarded: true }),
              createdAt: daysAgo(1, 17),
            },
          });
          created += 1;
        }
      }
    });
  }

  // Rejection emails
  const rejectedApps = applications.filter((a) => a.status === "rejected").slice(0, 40);
  for (const app of rejectedApps) {
    const cand = candidates.find((c) => c.id === app.candidateId);
    if (!cand) continue;
    const job = jobs.find((j) => j.id === app.jobOpeningId);
    await prisma.recruitmentCommunication.create({
      data: {
        type: RecruitmentCommunicationType.rejection,
        status: RecruitmentCommunicationStatus.delivered,
        subject: `Update on your application — ${job?.title ?? "Role"}`,
        body: `Hi ${cand.fullName},\n\nThank you for interviewing with ZEBL. We will not be moving forward at this time.\n\nTalent Team`,
        candidateId: cand.id,
        applicationId: app.id,
        jobOpeningId: app.jobOpeningId,
        templateId: templateByKey.app_rejected!.id,
        senderUserId: app.assignedRecruiterUserId,
        recipientEmail: cand.email,
        sentAt: addDays(app.stageEnteredAt, 1),
        deliveredAt: addDays(app.stageEnteredAt, 1),
        metadata: demoMeta({ folder: "sent", templateKey: "app_rejected" }),
      },
    });
    created += 1;
  }

  // Welcome / joining for conversions subset
  const hiredApps = applications.filter((a) => a.status === "hired").slice(0, 20);
  for (const app of hiredApps) {
    const cand = candidates.find((c) => c.id === app.candidateId);
    if (!cand) continue;
    await prisma.recruitmentCommunication.create({
      data: {
        type: RecruitmentCommunicationType.email_sent,
        status: RecruitmentCommunicationStatus.delivered,
        subject: "Welcome to ZEBL Technologies Pvt Ltd",
        body: `Hi ${cand.fullName},\n\nWelcome to ZEBL! Joining instructions are attached in the portal.\n\nPeople Team`,
        candidateId: cand.id,
        applicationId: app.id,
        jobOpeningId: app.jobOpeningId,
        templateId: templateByKey.welcome!.id,
        senderUserId: actors.hr_manager.userId,
        recipientEmail: cand.email,
        sentAt: daysAgo(1, 9),
        deliveredAt: daysAgo(1, 9),
        metadata: demoMeta({ folder: "sent", templateKey: "welcome" }),
      },
    });
    created += 1;
  }

  ctx.counts.communications = created;
  ctx.counts.communicationAttachments = attachments;
  ctx.counts.templates = templates.length;
  logStep(`Communications ready (messages=${created}, attachments=${attachments}, templates=${templates.length}).`);
}
