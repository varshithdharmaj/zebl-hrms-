import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/session";
import { listCandidatesCached } from "@/lib/recruitment/candidate/queries";
import { listJobOpeningsCached } from "@/lib/recruitment/job/queries";
import { listApplicationsCached } from "@/lib/recruitment/application/queries";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { listOffersCached } from "@/lib/recruitment/offer/queries";
import {
  getCommunicationCached,
  listEmailTemplatesCached,
} from "@/lib/recruitment/communication";
import {
  buildComposeRecipientOptions,
  mergeComposeTemplates,
} from "./build-compose-options";
import type {
  ComposeDraftInitial,
  ComposePageData,
  ComposePrefill,
} from "./compose-types";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "ZEBL";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function withReplyPrefix(subject: string | null | undefined): string {
  const value = subject?.trim() || "Message";
  return /^re:/i.test(value) ? value : `Re: ${value}`;
}

function withForwardPrefix(subject: string | null | undefined): string {
  const value = subject?.trim() || "Message";
  return /^fwd:/i.test(value) ? value : `Fwd: ${value}`;
}

function quoteForwardBody(args: {
  body: string | null | undefined;
  senderEmail: string | null | undefined;
  sentAt: Date | string | null | undefined;
}): string {
  const when =
    args.sentAt instanceof Date
      ? args.sentAt.toISOString()
      : typeof args.sentAt === "string"
        ? args.sentAt
        : "";
  const header = `---------- Forwarded message ----------\nFrom: ${args.senderEmail ?? "Unknown"}\nDate: ${when}\n\n`;
  return `${header}${args.body?.trim() || ""}`;
}

export async function loadComposePageData(
  session: SessionUser,
  draftId?: string,
  prefillInput?: ComposePrefill | null
): Promise<ComposePageData> {
  const parentId = prefillInput?.parentId ?? null;

  const [candidates, jobs, applications, interviews, offers, dbTemplates, draft, parent] =
    await Promise.all([
      listCandidatesCached(
        session,
        { includeArchived: false },
        { page: 1, pageSize: 50 },
        { field: "updatedAt", direction: "desc" }
      ),
      listJobOpeningsCached(
        session,
        {},
        { page: 1, pageSize: 50 },
        { field: "title", direction: "asc" }
      ),
      listApplicationsCached(session, {}, { page: 1, pageSize: 50 }),
      listInterviewsCached(session, {}, { page: 1, pageSize: 50 }),
      listOffersCached(session, {}, { page: 1, pageSize: 50 }),
      listEmailTemplatesCached(session),
      draftId ? getCommunicationCached(session, draftId) : Promise.resolve(null),
      parentId && !draftId
        ? getCommunicationCached(session, parentId).catch(() => null)
        : Promise.resolve(null),
    ]);

  let initialDraft: ComposeDraftInitial | null = null;
  if (draftId) {
    if (!draft || draft.status !== "draft" || draft.deletedAt) {
      notFound();
    }
    initialDraft = {
      id: draft.id,
      subject: draft.subject ?? "",
      body: draft.body ?? "",
      recipientEmail: draft.recipientEmail,
      candidateId: draft.candidateId,
      applicationId: draft.applicationId,
      jobOpeningId: draft.jobOpeningId,
      interviewId: draft.interviewId,
      offerId: draft.offerId,
      templateId: draft.templateId,
      status: draft.status,
      metadata: asRecord(draft.metadata),
      attachments: (draft.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        storagePath: attachment.storagePath,
        uploadedAt:
          attachment.uploadedAt instanceof Date
            ? attachment.uploadedAt.toISOString()
            : String(attachment.uploadedAt),
      })),
    };
  }

  let prefill: ComposePrefill | null = prefillInput ?? null;
  if (!draftId && parent && prefill) {
    const mode = prefill.mode ?? "compose";
    if (mode === "reply") {
      prefill = {
        ...prefill,
        subject: withReplyPrefix(parent.subject),
        body: "",
        candidateId: prefill.candidateId ?? parent.candidateId,
        recipientEmail: prefill.recipientEmail ?? parent.recipientEmail ?? parent.candidate?.email,
        applicationId: prefill.applicationId ?? parent.applicationId,
        jobOpeningId: prefill.jobOpeningId ?? parent.jobOpeningId,
        parentId: parent.id,
        threadId: parent.threadId ?? parent.id,
      };
    } else if (mode === "forward") {
      prefill = {
        ...prefill,
        subject: withForwardPrefix(parent.subject),
        body: quoteForwardBody({
          body: parent.body,
          senderEmail: parent.sender?.email,
          sentAt: parent.sentAt ?? parent.createdAt,
        }),
        candidateId: prefill.candidateId ?? parent.candidateId,
        applicationId: prefill.applicationId ?? parent.applicationId,
        jobOpeningId: prefill.jobOpeningId ?? parent.jobOpeningId,
        parentId: null,
        threadId: null,
        recipientEmail: prefill.recipientEmail ?? null,
      };
    }
  }

  const applicationItems = applications.items.map((item) => {
    const row = asRecord(item);
    const candidate = asRecord(row.candidate);
    const jobOpening = asRecord(row.jobOpening);
    return {
      id: String(row.id),
      candidateId: String(row.candidateId ?? ""),
      jobOpeningId: String(row.jobOpeningId ?? ""),
      candidate: {
        fullName: asString(candidate.fullName) ?? undefined,
        email: asString(candidate.email),
      },
      jobOpening: {
        title: asString(jobOpening.title) ?? undefined,
        location: asString(jobOpening.location),
      },
    };
  });

  const interviewItems = interviews.items.map((item) => {
    const row = asRecord(item);
    const application = asRecord(row.application);
    const candidate = asRecord(application.candidate);
    const jobOpening = asRecord(application.jobOpening);
    return {
      id: String(row.id),
      applicationId: String(row.applicationId ?? ""),
      scheduledStart: (row.scheduledStart as Date | string | null | undefined) ?? null,
      location: asString(row.location),
      application: {
        candidateId: asString(application.candidateId) ?? undefined,
        jobOpeningId: asString(application.jobOpeningId) ?? undefined,
        candidate: {
          fullName: asString(candidate.fullName) ?? undefined,
          email: asString(candidate.email),
        },
        jobOpening: {
          title: asString(jobOpening.title) ?? undefined,
          location: asString(jobOpening.location),
        },
      },
    };
  });

  const offerItems = offers.items.map((item) => {
    const row = asRecord(item);
    const application = asRecord(row.application);
    const candidate = asRecord(application.candidate);
    const jobOpening = asRecord(application.jobOpening);
    return {
      id: String(row.id),
      applicationId: String(row.applicationId ?? ""),
      ctc: row.ctc,
      joiningDate: (row.joiningDate as Date | string | null | undefined) ?? null,
      location: asString(row.location),
      application: {
        candidateId: asString(application.candidateId) ?? undefined,
        jobOpeningId: asString(application.jobOpeningId) ?? undefined,
        candidate: {
          fullName: asString(candidate.fullName) ?? undefined,
          email: asString(candidate.email),
        },
        jobOpening: {
          title: asString(jobOpening.title) ?? undefined,
          location: asString(jobOpening.location),
        },
      },
    };
  });

  return {
    companyName: COMPANY_NAME,
    templates: mergeComposeTemplates(dbTemplates),
    recipients: buildComposeRecipientOptions({
      candidates: candidates.items.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        currentTitle: item.currentTitle ?? null,
      })),
      jobs: jobs.items.map((item) => ({
        id: item.id,
        title: item.title,
        location: item.location ?? null,
      })),
      applications: applicationItems,
      interviews: interviewItems,
      offers: offerItems,
      companyName: COMPANY_NAME,
    }),
    initialDraft,
    prefill,
  };
}
