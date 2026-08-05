import type { ComposeTemplateOption } from "@/lib/recruitment/communication/system-templates";
import { SYSTEM_EMAIL_TEMPLATES } from "@/lib/recruitment/communication/system-templates";
import type { ComposeRecipientOption } from "./compose-types";

type CandidateLike = {
  id: string;
  fullName: string;
  email: string | null;
  currentTitle?: string | null;
};

type JobLike = {
  id: string;
  title: string;
  location?: string | null;
};

type ApplicationLike = {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  candidate?: { fullName?: string; email?: string | null } | null;
  jobOpening?: { title?: string; location?: string | null } | null;
};

type InterviewLike = {
  id: string;
  applicationId: string;
  scheduledStart?: Date | string | null;
  location?: string | null;
  application?: {
    candidateId?: string;
    jobOpeningId?: string;
    candidate?: { fullName?: string; email?: string | null } | null;
    jobOpening?: { title?: string; location?: string | null } | null;
  } | null;
};

type OfferLike = {
  id: string;
  applicationId: string;
  ctc?: unknown;
  joiningDate?: Date | string | null;
  location?: string | null;
  application?: {
    candidateId?: string;
    jobOpeningId?: string;
    candidate?: { fullName?: string; email?: string | null } | null;
    jobOpening?: { title?: string; location?: string | null } | null;
  } | null;
};

type DbTemplateLike = {
  id: string;
  name: string;
  type: ComposeTemplateOption["type"];
  subject: string;
  body: string;
  isSystem: boolean;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function buildComposeRecipientOptions(input: {
  candidates: CandidateLike[];
  jobs: JobLike[];
  applications: ApplicationLike[];
  interviews: InterviewLike[];
  offers: OfferLike[];
  companyName: string;
}): ComposeRecipientOption[] {
  const { candidates, jobs, applications, interviews, offers, companyName } = input;
  const options: ComposeRecipientOption[] = [];

  for (const candidate of candidates) {
    options.push({
      id: `candidate:${candidate.id}`,
      kind: "candidate",
      label: candidate.fullName,
      secondaryLabel: candidate.currentTitle ?? undefined,
      email: candidate.email,
      candidateId: candidate.id,
      variables: {
        candidateName: candidate.fullName,
        company: companyName,
        jobTitle: candidate.currentTitle ?? "",
      },
    });
  }

  for (const job of jobs) {
    options.push({
      id: `job:${job.id}`,
      kind: "job",
      label: job.title,
      secondaryLabel: job.location ?? undefined,
      email: null,
      jobOpeningId: job.id,
      variables: {
        jobTitle: job.title,
        location: job.location ?? "",
        company: companyName,
      },
    });
  }

  for (const application of applications) {
    const name = application.candidate?.fullName ?? "Application";
    const email = application.candidate?.email ?? null;
    options.push({
      id: `application:${application.id}`,
      kind: "application",
      label: name,
      secondaryLabel: application.jobOpening?.title ?? undefined,
      email,
      candidateId: application.candidateId,
      applicationId: application.id,
      jobOpeningId: application.jobOpeningId,
      variables: {
        candidateName: name,
        jobTitle: application.jobOpening?.title ?? "",
        location: application.jobOpening?.location ?? "",
        company: companyName,
      },
    });
  }

  for (const interview of interviews) {
    const name = interview.application?.candidate?.fullName ?? "Interview";
    const email = interview.application?.candidate?.email ?? null;
    options.push({
      id: `interview:${interview.id}`,
      kind: "interview",
      label: `${name} interview`,
      secondaryLabel: interview.application?.jobOpening?.title ?? undefined,
      email,
      interviewId: interview.id,
      applicationId: interview.applicationId,
      candidateId: interview.application?.candidateId ?? null,
      jobOpeningId: interview.application?.jobOpeningId ?? null,
      variables: {
        candidateName: name,
        jobTitle: interview.application?.jobOpening?.title ?? "",
        location: interview.location ?? interview.application?.jobOpening?.location ?? "",
        date: formatDate(interview.scheduledStart),
        time: formatTime(interview.scheduledStart),
        company: companyName,
      },
    });
  }

  for (const offer of offers) {
    const name = offer.application?.candidate?.fullName ?? "Offer";
    const email = offer.application?.candidate?.email ?? null;
    options.push({
      id: `offer:${offer.id}`,
      kind: "offer",
      label: `${name} offer`,
      secondaryLabel: offer.application?.jobOpening?.title ?? undefined,
      email,
      offerId: offer.id,
      applicationId: offer.applicationId,
      candidateId: offer.application?.candidateId ?? null,
      jobOpeningId: offer.application?.jobOpeningId ?? null,
      variables: {
        candidateName: name,
        jobTitle: offer.application?.jobOpening?.title ?? "",
        location: offer.location ?? offer.application?.jobOpening?.location ?? "",
        offerSalary: offer.ctc != null ? String(offer.ctc) : "",
        joiningDate: formatDate(offer.joiningDate),
        company: companyName,
      },
    });
  }

  return options;
}

export function mergeComposeTemplates(
  dbTemplates: DbTemplateLike[]
): ComposeTemplateOption[] {
  const fromDb: ComposeTemplateOption[] = dbTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    subject: template.subject,
    body: template.body,
    isSystem: template.isSystem,
  }));

  const seen = new Set(fromDb.map((template) => template.name.toLowerCase()));
  const systemExtras = SYSTEM_EMAIL_TEMPLATES.filter(
    (template) => !seen.has(template.name.toLowerCase())
  );

  return [...systemExtras, ...fromDb];
}
