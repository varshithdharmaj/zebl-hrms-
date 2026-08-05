import type { RecruitmentDocumentType } from "@/generated/prisma/enums";

export const DOCUMENT_TYPE_LABELS: Record<RecruitmentDocumentType, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  portfolio: "Portfolio",
  assessment: "Assessment",
  offer_letter: "Offer Letter",
  identity: "Identity Document",
  other: "Other Document",
};
