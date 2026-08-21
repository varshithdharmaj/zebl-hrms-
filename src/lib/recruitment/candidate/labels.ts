import type { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  active: "Active",
  hired: "Hired",
  talent_pool: "Talent Pool",
  do_not_hire: "Do Not Hire",
  archived: "Archived",
  merged: "Merged",
};

export const CANDIDATE_SOURCE_LABELS: Record<CandidateSource, string> = {
  manual_upload: "Manual Upload",
  referral: "Referral",
  csv_import: "CSV Import",
  google_forms_csv: "Google Forms CSV",
  other: "Other",
  manual: "Manual",
  import: "Import",
  employee_referral: "Employee Referral",
  career_portal_future: "Career Portal Future",
  career_portal: "Career Portal",
};
