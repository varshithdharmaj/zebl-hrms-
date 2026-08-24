import "server-only";

import { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import { getHrRecipients } from "@/lib/notifications/recipient-resolver";
import { sanitizeText } from "@/lib/notifications/sanitize";
import { getAppBaseUrl } from "@/lib/config/app-url";
import { logger } from "@/lib/observability/logger";

function failureReason(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return "unknown";
}

/**
 * Candidate confirmation — queued only, never blocks/rolls back the
 * submission transaction (Phase-3 hardening §3). Payload is deliberately
 * minimal: GenericNotificationEmail renders every string/number key of the
 * payload to the recipient, so nothing beyond candidate-safe fields belongs
 * here — no internal ids, no pipeline stage, no HR notes, no compensation.
 */
export async function queueCandidateConfirmation(input: {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  referenceCode: string;
}): Promise<void> {
  try {
    const candidateName = sanitizeText(input.candidateName, 200) || "there";
    const jobTitle = sanitizeText(input.jobTitle, 200);
    await enqueueNotification({
      type: NotificationType.recruitment_public_application_received,
      channel: NotificationChannel.email,
      recipient: input.candidateEmail,
      subject: `Application received — ${jobTitle}`,
      payload: {
        message: `Hi ${candidateName}, thanks for applying to ${jobTitle}. We've received your application (reference ${input.referenceCode}) and our team will review it. We'll be in touch about next steps.`,
        candidateName,
        jobTitle,
        referenceCode: input.referenceCode,
      },
      correlationId: `public-apply-confirmation-${input.referenceCode}`,
    });
  } catch (error) {
    logger.warn("recruitment.public_apply.candidate_confirmation_failed", {
      entityType: "public_application_submission",
      reason: failureReason(error),
    });
  }
}

/**
 * HR notification — targets the job's owning recruiter if one is assigned,
 * otherwise falls back to the existing getHrRecipients() resolver (same
 * fallback pattern as resolveCurrentStepApprover() for leave approvals).
 * Links to the existing, session-gated Application detail page — never a
 * public URL, never sent to the candidate.
 */
export async function queueHrPublicApplicationAlert(input: {
  ownerRecruiterUserId: string | null;
  candidateName: string;
  jobTitle: string;
  applicationId: string;
  referenceCode: string;
}): Promise<void> {
  try {
    const recipients = await resolveRecipients(input.ownerRecruiterUserId);
    if (recipients.length === 0) return;

    const candidateName = sanitizeText(input.candidateName, 200);
    const jobTitle = sanitizeText(input.jobTitle, 200);
    const applicationUrl = `${getAppBaseUrl()}/admin/recruitment/applications/${input.applicationId}`;

    await Promise.all(
      recipients.map((recipient) =>
        enqueueNotification({
          type: NotificationType.recruitment_public_application_hr_alert,
          channel: NotificationChannel.email,
          recipient: recipient.email,
          subject: `New public application — ${jobTitle}`,
          payload: {
            message: `${candidateName} applied to ${jobTitle} via the career portal.`,
            candidateName,
            jobTitle,
            source: "Public application",
            referenceCode: input.referenceCode,
            applicationUrl,
          },
          correlationId: `public-apply-hr-alert-${input.applicationId}-${recipient.email}`,
          userId: recipient.userId,
        })
      )
    );
  } catch (error) {
    logger.warn("recruitment.public_apply.hr_alert_failed", {
      entityType: "application",
      entityId: input.applicationId,
      reason: failureReason(error),
    });
  }
}

async function resolveRecipients(
  ownerRecruiterUserId: string | null
): Promise<{ email: string; userId?: string }[]> {
  if (ownerRecruiterUserId) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerRecruiterUserId },
      select: { id: true, email: true },
    });
    if (owner) return [{ email: owner.email, userId: owner.id }];
  }
  const hr = await getHrRecipients();
  return hr.map((r) => ({ email: r.email, userId: r.userId }));
}
