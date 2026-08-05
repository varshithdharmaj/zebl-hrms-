import { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";

/**
 * UI categories for template management.
 * Maps to existing RecruitmentEmailTemplateType values (no schema rewrite).
 */
export type TemplateCategoryId =
  | "interview_invitation"
  | "interview_reminder"
  | "offer_letter"
  | "offer_reminder"
  | "application_received"
  | "application_rejected"
  | "application_accepted"
  | "welcome"
  | "general"
  | "custom";

export type TemplateCategory = {
  id: TemplateCategoryId;
  label: string;
  type: RecruitmentEmailTemplateType;
};

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  {
    id: "interview_invitation",
    label: "Interview Invitation",
    type: RecruitmentEmailTemplateType.interview_invitation,
  },
  {
    id: "interview_reminder",
    label: "Interview Reminder",
    type: RecruitmentEmailTemplateType.interview_reminder,
  },
  {
    id: "offer_letter",
    label: "Offer Letter",
    type: RecruitmentEmailTemplateType.offer_letter,
  },
  {
    id: "offer_reminder",
    label: "Offer Reminder",
    type: RecruitmentEmailTemplateType.offer_reminder,
  },
  {
    id: "application_received",
    label: "Application Received",
    type: RecruitmentEmailTemplateType.general,
  },
  {
    id: "application_rejected",
    label: "Application Rejected",
    type: RecruitmentEmailTemplateType.rejection,
  },
  {
    id: "application_accepted",
    label: "Application Accepted",
    type: RecruitmentEmailTemplateType.welcome,
  },
  {
    id: "welcome",
    label: "Welcome",
    type: RecruitmentEmailTemplateType.welcome,
  },
  {
    id: "general",
    label: "General",
    type: RecruitmentEmailTemplateType.general,
  },
  {
    id: "custom",
    label: "Custom",
    type: RecruitmentEmailTemplateType.general,
  },
] as const;

export function templateTypeLabel(type: RecruitmentEmailTemplateType): string {
  switch (type) {
    case RecruitmentEmailTemplateType.interview_invitation:
      return "Interview Invitation";
    case RecruitmentEmailTemplateType.interview_reminder:
      return "Interview Reminder";
    case RecruitmentEmailTemplateType.interview_cancelled:
      return "Interview Cancelled";
    case RecruitmentEmailTemplateType.interview_rescheduled:
      return "Interview Rescheduled";
    case RecruitmentEmailTemplateType.offer_letter:
      return "Offer Letter";
    case RecruitmentEmailTemplateType.offer_reminder:
      return "Offer Reminder";
    case RecruitmentEmailTemplateType.offer_expired:
      return "Offer Expired";
    case RecruitmentEmailTemplateType.rejection:
      return "Application Rejected";
    case RecruitmentEmailTemplateType.welcome:
      return "Welcome";
    case RecruitmentEmailTemplateType.general:
      return "General";
    default:
      return type;
  }
}

export function categoryToTemplateType(
  category: TemplateCategoryId
): RecruitmentEmailTemplateType {
  const match = TEMPLATE_CATEGORIES.find((item) => item.id === category);
  return match?.type ?? RecruitmentEmailTemplateType.general;
}
