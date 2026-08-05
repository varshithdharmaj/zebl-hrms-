import type { JobOpeningStatus, JobEmploymentType } from "@/generated/prisma/enums";

export const JOB_STATUS_LABELS: Record<JobOpeningStatus, string> = {
  draft: "Draft",
  open: "Open",
  on_hold: "On Hold",
  closed: "Closed",
  filled: "Filled",
};

export const JOB_EMPLOYMENT_TYPE_LABELS: Record<JobEmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  intern: "Intern",
  temporary: "Temporary",
  other: "Other",
};

export const WORK_MODE_OPTIONS = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const HEADCOUNT_URGENCY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;
