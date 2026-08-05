/**
 * Idempotent wipe of all ZEBL recruitment demo data.
 * Safe: only deletes records tagged by demo marker / DEMO-* codes / demo email domains.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import {
  CANDIDATE_EMAIL_DOMAIN,
  DEMO_EMAIL_DOMAIN,
  DEMO_MARKER,
  DEMO_TAG,
} from "./constants";
import { logStep } from "./helpers";

export async function resetDemoData(prisma: PrismaClient): Promise<void> {
  logStep("Resetting demo recruitment data…");

  const demoJobs = await prisma.jobOpening.findMany({
    where: { OR: [{ code: { startsWith: "DEMO-JOB-" } }, { code: { startsWith: "DEMO-" } }] },
    select: { id: true },
  });
  const jobIds = demoJobs.map((j) => j.id);

  const demoCandidates = await prisma.candidate.findMany({
    where: {
      OR: [
        { email: { endsWith: `@${CANDIDATE_EMAIL_DOMAIN}` } },
        { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
      ],
    },
    select: { id: true, employeeId: true },
  });
  const candidateIds = demoCandidates.map((c) => c.id);
  const convertedEmployeeIds = demoCandidates
    .map((c) => c.employeeId)
    .filter((id): id is number => id != null);

  const demoApps = await prisma.application.findMany({
    where: {
      OR: [
        { candidateId: { in: candidateIds } },
        { jobOpeningId: { in: jobIds } },
      ],
    },
    select: { id: true },
  });
  const applicationIds = demoApps.map((a) => a.id);

  const demoOffers = await prisma.offer.findMany({
    where: { applicationId: { in: applicationIds } },
    select: { id: true },
  });
  const offerIds = demoOffers.map((o) => o.id);

  const demoInterviews = await prisma.interview.findMany({
    where: { applicationId: { in: applicationIds } },
    select: { id: true },
  });
  const interviewIds = demoInterviews.map((i) => i.id);

  const demoComms = await prisma.recruitmentCommunication.findMany({
    where: {
      OR: [
        { candidateId: { in: candidateIds } },
        { applicationId: { in: applicationIds } },
        { jobOpeningId: { in: jobIds } },
        { metadata: { path: ["demoSeed"], equals: DEMO_MARKER } },
      ],
    },
    select: { id: true },
  });
  const communicationIds = demoComms.map((c) => c.id);

  // FK-safe delete order
  if (communicationIds.length) {
    await prisma.recruitmentCommunicationAttachment.deleteMany({
      where: { communicationId: { in: communicationIds } },
    });
    // Clear parent/reply self-FK first
    await prisma.recruitmentCommunication.updateMany({
      where: { id: { in: communicationIds } },
      data: { parentId: null },
    });
    await prisma.recruitmentCommunication.deleteMany({
      where: { id: { in: communicationIds } },
    });
  }

  await prisma.recruitmentMetricSnapshot.deleteMany({
    where: { scopeKey: { startsWith: "demo:" } },
  });

  await prisma.notification.deleteMany({
    where: { correlationId: { startsWith: "demo-seed:" } },
  });

  if (applicationIds.length || offerIds.length || candidateIds.length) {
    await prisma.employeeConversionSnapshot.deleteMany({
      where: {
        OR: [
          { applicationId: { in: applicationIds } },
          { offerId: { in: offerIds } },
          { candidateId: { in: candidateIds } },
        ],
      },
    });
  }

  if (offerIds.length) {
    await prisma.offerRevision.deleteMany({ where: { offerId: { in: offerIds } } });
    await prisma.offer.deleteMany({ where: { id: { in: offerIds } } });
  }

  if (applicationIds.length) {
    await prisma.hiringDecision.deleteMany({ where: { applicationId: { in: applicationIds } } });
  }

  if (interviewIds.length) {
    await prisma.interviewAttachment.deleteMany({ where: { interviewId: { in: interviewIds } } });
    await prisma.interviewFeedback.deleteMany({ where: { interviewId: { in: interviewIds } } });
    await prisma.interviewPanelist.deleteMany({ where: { interviewId: { in: interviewIds } } });
    await prisma.interview.deleteMany({ where: { id: { in: interviewIds } } });
  }

  if (applicationIds.length) {
    await prisma.applicationStageHistory.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
    await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  }

  if (candidateIds.length) {
    await prisma.talentPoolEntry.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateAiInsight.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateTag.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateChatMessage.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateNote.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateCertification.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateProject.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateSkill.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateEducation.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateExperience.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.candidatePersonal.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.intakeItem.deleteMany({ where: { candidateId: { in: candidateIds } } });
    await prisma.recruitmentTimelineEvent.deleteMany({
      where: { candidateId: { in: candidateIds } },
    });
    await prisma.candidate.updateMany({
      where: { id: { in: candidateIds } },
      data: { employeeId: null, mergedIntoCandidateId: null },
    });
    await prisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
  }

  if (jobIds.length) {
    await prisma.intakeItem.deleteMany({ where: { jobOpeningId: { in: jobIds } } });
    await prisma.jobOpeningNote.deleteMany({ where: { jobOpeningId: { in: jobIds } } });
    await prisma.jobOpeningDocument.deleteMany({ where: { jobOpeningId: { in: jobIds } } });
    await prisma.hiringTeamMember.deleteMany({ where: { jobOpeningId: { in: jobIds } } });
    await prisma.jobOpeningStage.deleteMany({ where: { jobOpeningId: { in: jobIds } } });
    await prisma.recruitmentTimelineEvent.deleteMany({
      where: { jobOpeningId: { in: jobIds } },
    });
    await prisma.jobOpening.deleteMany({ where: { id: { in: jobIds } } });
  }

  await prisma.recruitmentTimelineEvent.deleteMany({
    where: { metadata: { path: ["demoSeed"], equals: DEMO_MARKER } },
  });

  await prisma.recruitmentEmailTemplate.deleteMany({
    where: { name: { startsWith: "Demo ·" } },
  });

  await prisma.recruitmentSavedFilter.deleteMany({
    where: { name: { startsWith: "Demo ·" } },
  });

  // Converted hire employees (DEMO-HIRE-*)
  const hireEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeCode: { startsWith: "DEMO-HIRE-" } },
        { id: { in: convertedEmployeeIds } },
      ],
    },
    select: { id: true },
  });
  const hireIds = [...new Set(hireEmployees.map((e) => e.id))];

  if (hireIds.length) {
    await prisma.user.deleteMany({ where: { employeeId: { in: hireIds } } });
    await prisma.leaveTransaction.deleteMany({ where: { employeeId: { in: hireIds } } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: { in: hireIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: hireIds } } });
  }

  // Demo staff users/employees (keep only if --keep-users not set; default wipe)
  const staffEmployees = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "DEMO-EMP-" } },
    select: { id: true },
  });
  const staffIds = staffEmployees.map((e) => e.id);

  if (staffIds.length) {
    await prisma.hiringTeamMember.deleteMany({ where: { employeeId: { in: staffIds } } });
    await prisma.interviewPanelist.deleteMany({ where: { employeeId: { in: staffIds } } });
    await prisma.interviewFeedback.deleteMany({ where: { authorEmployeeId: { in: staffIds } } });
    await prisma.user.deleteMany({ where: { employeeId: { in: staffIds } } });
    await prisma.leaveTransaction.deleteMany({ where: { employeeId: { in: staffIds } } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: { in: staffIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: staffIds } } });
  }

  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });

  await prisma.candidateTag.deleteMany({
    where: { tag: { name: { in: [DEMO_TAG, ...SOURCE_TAG_NAMES] } } },
  });
  await prisma.recruitmentTag.deleteMany({
    where: { name: { in: [DEMO_TAG, ...SOURCE_TAG_NAMES] } },
  });

  logStep("Demo data reset complete.");
}

const SOURCE_TAG_NAMES = [
  "source:linkedin",
  "source:referral",
  "source:website",
  "source:campus",
  "source:indeed",
  "source:naukri",
  "source:monster",
  "source:employee_referral",
  "source:github",
  "source:walk_in",
];
