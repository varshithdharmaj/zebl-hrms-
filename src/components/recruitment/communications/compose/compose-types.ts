import type { TemplateVariables } from "@/lib/recruitment/communication/template-renderer";
import type { ComposeTemplateOption } from "@/lib/recruitment/communication/system-templates";

export type RecipientKind =
  | "candidate"
  | "application"
  | "job"
  | "interview"
  | "offer"
  | "manual";

export type ComposeRecipientOption = {
  id: string;
  kind: RecipientKind;
  label: string;
  secondaryLabel?: string;
  email: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  jobOpeningId?: string | null;
  interviewId?: string | null;
  offerId?: string | null;
  variables?: Partial<TemplateVariables>;
};

export type ComposeDraftInitial = {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string | null;
  candidateId: string | null;
  applicationId: string | null;
  jobOpeningId: string | null;
  interviewId: string | null;
  offerId: string | null;
  templateId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    uploadedAt: string;
  }>;
};

export type ComposePrefill = {
  mode?: "compose" | "reply" | "forward";
  candidateId?: string | null;
  recipientEmail?: string | null;
  applicationId?: string | null;
  jobOpeningId?: string | null;
  interviewId?: string | null;
  offerId?: string | null;
  parentId?: string | null;
  threadId?: string | null;
  subject?: string | null;
  body?: string | null;
  systemTemplateId?: string | null;
};

export type ComposeFormState = {
  draftId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  additionalRecipients: string[];
  candidateId: string | null;
  applicationId: string | null;
  jobOpeningId: string | null;
  interviewId: string | null;
  offerId: string | null;
  templateId: string | null;
  systemTemplateId: string | null;
  parentId: string | null;
  threadId: string | null;
  variables: TemplateVariables;
};

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type ComposePageData = {
  recipients: ComposeRecipientOption[];
  templates: ComposeTemplateOption[];
  companyName: string;
  initialDraft?: ComposeDraftInitial | null;
  prefill?: ComposePrefill | null;
};

export const EMPTY_VARIABLES: TemplateVariables = {
  candidateName: "",
  jobTitle: "",
  company: "",
  interviewer: "",
  date: "",
  interviewDate: "",
  time: "",
  location: "",
  offerSalary: "",
  offerAmount: "",
  joiningDate: "",
};

export const SUBJECT_MAX = 500;
export const BODY_MAX = 20000;
