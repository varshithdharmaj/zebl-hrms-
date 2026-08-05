import { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";
import type { TemplateVariables } from "./template-renderer";

export type ComposeTemplateOption = {
  id: string;
  name: string;
  type: RecruitmentEmailTemplateType;
  subject: string;
  body: string;
  isSystem: boolean;
};

export const TEMPLATE_PLACEHOLDERS: Array<keyof TemplateVariables> = [
  "candidateName",
  "jobTitle",
  "company",
  "interviewer",
  "date",
  "interviewDate",
  "time",
  "location",
  "offerSalary",
  "offerAmount",
  "joiningDate",
];

export const SYSTEM_EMAIL_TEMPLATES: readonly ComposeTemplateOption[] = [
  {
    id: "system:interview_invitation",
    name: "Interview Invitation",
    type: RecruitmentEmailTemplateType.interview_invitation,
    subject: "Interview invitation — {{jobTitle}}",
    body: `Dear {{candidateName}},

We would like to invite you to interview for the {{jobTitle}} role at {{company}}.

Date: {{date}}
Time: {{time}}
Location: {{location}}
Interviewer: {{interviewer}}

Please reply to confirm your availability.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:interview_reminder",
    name: "Interview Reminder",
    type: RecruitmentEmailTemplateType.interview_reminder,
    subject: "Reminder: Interview for {{jobTitle}}",
    body: `Dear {{candidateName}},

This is a reminder for your upcoming interview for {{jobTitle}} at {{company}}.

Date: {{date}}
Time: {{time}}
Location: {{location}}
Interviewer: {{interviewer}}

We look forward to speaking with you.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:offer_letter",
    name: "Offer Letter",
    type: RecruitmentEmailTemplateType.offer_letter,
    subject: "Offer of employment — {{jobTitle}}",
    body: `Dear {{candidateName}},

We are pleased to offer you the position of {{jobTitle}} at {{company}}.

Offered CTC: {{offerSalary}}
Joining date: {{joiningDate}}
Location: {{location}}

Please review the attached offer details and let us know your decision.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:offer_reminder",
    name: "Offer Reminder",
    type: RecruitmentEmailTemplateType.offer_reminder,
    subject: "Reminder: Offer for {{jobTitle}}",
    body: `Dear {{candidateName}},

This is a friendly reminder regarding your offer for {{jobTitle}} at {{company}}.

Offered CTC: {{offerSalary}}
Proposed joining date: {{joiningDate}}

Please share your decision at your earliest convenience.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:rejection",
    name: "Rejection",
    type: RecruitmentEmailTemplateType.rejection,
    subject: "Update on your application — {{jobTitle}}",
    body: `Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} role at {{company}}.

After careful consideration, we will not be moving forward with your application at this time. We appreciate the time you invested and wish you success in your career search.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:welcome",
    name: "Welcome Email",
    type: RecruitmentEmailTemplateType.welcome,
    subject: "Welcome to {{company}}",
    body: `Dear {{candidateName}},

Welcome to {{company}}! We are excited for you to join us as {{jobTitle}}.

Your joining date is {{joiningDate}} at {{location}}.

We look forward to having you on the team.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:general",
    name: "General Message",
    type: RecruitmentEmailTemplateType.general,
    subject: "Message regarding {{jobTitle}}",
    body: `Dear {{candidateName}},

[Write your message here]

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:application_received",
    name: "Application Received",
    type: RecruitmentEmailTemplateType.general,
    subject: "We received your application — {{jobTitle}}",
    body: `Dear {{candidateName}},

Thank you for applying to the {{jobTitle}} role at {{company}}. We have received your application and our team will review it shortly.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
  {
    id: "system:application_accepted",
    name: "Application Accepted",
    type: RecruitmentEmailTemplateType.welcome,
    subject: "Next steps for {{jobTitle}}",
    body: `Dear {{candidateName}},

Congratulations! We would like to move forward with your application for {{jobTitle}} at {{company}}.

Our team will contact you soon with interview details.

Best regards,
{{company}} Talent Team`,
    isSystem: true,
  },
];

export function isSystemTemplateId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("system:"));
}

export function findSystemTemplate(id: string): ComposeTemplateOption | null {
  return SYSTEM_EMAIL_TEMPLATES.find((template) => template.id === id) ?? null;
}
