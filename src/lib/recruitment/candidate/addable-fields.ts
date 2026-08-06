import { PreferredWorkMode } from "@/generated/prisma/enums";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import { updateCandidateSchema } from "@/lib/validation/schemas/recruitment/candidates";

export type AddableFieldInputType =
  | "text"
  | "number"
  | "money"
  | "url"
  | "date"
  | "textarea"
  | "select";

export type AddableFieldKey =
  | "expectedCtc"
  | "currentCtc"
  | "noticePeriodDays"
  | "linkedinUrl"
  | "githubUrl"
  | "portfolioUrl"
  | "location"
  | "preferredLocation"
  | "dateOfBirth"
  | "nationality"
  | "headline"
  | "currentCompany"
  | "currentTitle"
  | "totalExperienceYears"
  | "earliestJoinDate"
  | "preferredWorkMode"
  | "alternatePhone"
  | "professionalSummary"
  | "availabilityNotes";

export type CandidateAddableFieldDef = {
  key: AddableFieldKey;
  label: string;
  inputType: AddableFieldInputType;
  placeholder?: string;
  hint?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** True when the field has no usable value on the profile. */
  isEmpty: (candidate: CandidateDetail) => boolean;
  /** Build a partial update payload for updateCandidateAction. */
  toUpdatePayload: (rawValue: string) => Record<string, unknown>;
};

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * Config-driven list of single-value profile fields that can be completed
 * via the generic "+ Add Field" dialog. Collections (skills, experience, …)
 * stay on their own actions and are intentionally excluded.
 */
export const CANDIDATE_ADDABLE_FIELDS: readonly CandidateAddableFieldDef[] = [
  {
    key: "expectedCtc",
    label: "Expected CTC",
    inputType: "money",
    placeholder: "e.g. 1800000",
    hint: "Amount only (currency stays on the profile).",
    isEmpty: (c) => isBlank(c.expectedCtc),
    toUpdatePayload: (v) => ({ expectedCtc: v.trim() }),
  },
  {
    key: "currentCtc",
    label: "Current CTC",
    inputType: "money",
    placeholder: "e.g. 1500000",
    hint: "Amount only (currency stays on the profile).",
    isEmpty: (c) => isBlank(c.currentCtc),
    toUpdatePayload: (v) => ({ currentCtc: v.trim() }),
  },
  {
    key: "noticePeriodDays",
    label: "Notice Period",
    inputType: "number",
    placeholder: "e.g. 30",
    hint: "Days until the candidate can join after resigning.",
    isEmpty: (c) => c.noticePeriodDays == null,
    toUpdatePayload: (v) => ({ noticePeriodDays: Number(v.trim()) }),
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    inputType: "url",
    placeholder: "https://linkedin.com/in/…",
    isEmpty: (c) => isBlank(c.linkedinUrl),
    toUpdatePayload: (v) => ({ linkedinUrl: v.trim() }),
  },
  {
    key: "githubUrl",
    label: "GitHub",
    inputType: "url",
    placeholder: "https://github.com/…",
    isEmpty: (c) => isBlank(c.githubUrl),
    toUpdatePayload: (v) => ({ githubUrl: v.trim() }),
  },
  {
    key: "portfolioUrl",
    label: "Portfolio",
    inputType: "url",
    placeholder: "https://…",
    isEmpty: (c) => isBlank(c.personal?.portfolioUrl),
    toUpdatePayload: (v) => ({ portfolioUrl: v.trim() }),
  },
  {
    key: "location",
    label: "Current Location",
    inputType: "text",
    placeholder: "e.g. Hyderabad",
    isEmpty: (c) => isBlank(c.location),
    toUpdatePayload: (v) => ({ location: v.trim() }),
  },
  {
    key: "preferredLocation",
    label: "Preferred Location",
    inputType: "text",
    placeholder: "e.g. Bangalore / Remote",
    isEmpty: (c) => isBlank(c.personal?.preferredLocation),
    toUpdatePayload: (v) => ({ preferredLocation: v.trim() }),
  },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    inputType: "date",
    isEmpty: (c) => c.dateOfBirth == null,
    toUpdatePayload: (v) => ({ dateOfBirth: v.trim() }),
  },
  {
    key: "nationality",
    label: "Nationality",
    inputType: "text",
    placeholder: "e.g. Indian",
    isEmpty: (c) => isBlank(c.personal?.nationality),
    toUpdatePayload: (v) => ({ nationality: v.trim() }),
  },
  {
    key: "headline",
    label: "Headline",
    inputType: "text",
    placeholder: "e.g. Senior Backend Engineer",
    isEmpty: (c) => isBlank(c.headline),
    toUpdatePayload: (v) => ({ headline: v.trim() }),
  },
  {
    key: "currentCompany",
    label: "Current Company",
    inputType: "text",
    placeholder: "e.g. Acme Corp",
    isEmpty: (c) => isBlank(c.currentCompany),
    toUpdatePayload: (v) => ({ currentCompany: v.trim() }),
  },
  {
    key: "currentTitle",
    label: "Current Designation",
    inputType: "text",
    placeholder: "e.g. Software Engineer",
    isEmpty: (c) => isBlank(c.currentTitle),
    toUpdatePayload: (v) => ({ currentTitle: v.trim() }),
  },
  {
    key: "totalExperienceYears",
    label: "Total Experience",
    inputType: "number",
    placeholder: "e.g. 5.5",
    hint: "Years of experience (up to 1 decimal).",
    isEmpty: (c) => isBlank(c.totalExperienceYears),
    toUpdatePayload: (v) => ({ totalExperienceYears: v.trim() }),
  },
  {
    key: "earliestJoinDate",
    label: "Earliest Joining",
    inputType: "date",
    isEmpty: (c) => c.earliestJoinDate == null,
    toUpdatePayload: (v) => ({ earliestJoinDate: v.trim() }),
  },
  {
    key: "preferredWorkMode",
    label: "Preferred Work Mode",
    inputType: "select",
    options: [
      { value: PreferredWorkMode.remote, label: "Remote" },
      { value: PreferredWorkMode.hybrid, label: "Hybrid" },
      { value: PreferredWorkMode.onsite, label: "Onsite" },
    ],
    isEmpty: (c) => c.preferredWorkMode == null,
    toUpdatePayload: (v) => ({ preferredWorkMode: v.trim() }),
  },
  {
    key: "alternatePhone",
    label: "Alternate Phone",
    inputType: "text",
    placeholder: "e.g. +919876543210",
    isEmpty: (c) => isBlank(c.alternatePhone),
    toUpdatePayload: (v) => ({ alternatePhone: v.trim() }),
  },
  {
    key: "professionalSummary",
    label: "Professional Summary",
    inputType: "textarea",
    placeholder: "Short professional summary…",
    isEmpty: (c) => isBlank(c.professionalSummary),
    toUpdatePayload: (v) => ({ professionalSummary: v.trim() }),
  },
  {
    key: "availabilityNotes",
    label: "Availability Notes",
    inputType: "textarea",
    placeholder: "Notes about availability…",
    isEmpty: (c) => isBlank(c.availabilityNotes),
    toUpdatePayload: (v) => ({ availabilityNotes: v.trim() }),
  },
] as const;

export function getAddableFieldDef(key: AddableFieldKey): CandidateAddableFieldDef | undefined {
  return CANDIDATE_ADDABLE_FIELDS.find((field) => field.key === key);
}

/** Fields still empty on this candidate (order matches config). */
export function listMissingAddableFields(
  candidate: CandidateDetail
): CandidateAddableFieldDef[] {
  return CANDIDATE_ADDABLE_FIELDS.filter((field) => field.isEmpty(candidate));
}

export function hasMissingAddableFields(candidate: CandidateDetail): boolean {
  return listMissingAddableFields(candidate).length > 0;
}

/**
 * Validate a single addable field using the shared updateCandidateSchema.
 * Returns an error message or null when valid.
 */
export function validateAddableFieldValue(
  field: CandidateAddableFieldDef,
  rawValue: string
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return `${field.label} is required.`;

  const payload = field.toUpdatePayload(trimmed);
  const parsed = updateCandidateSchema.safeParse({ id: "add-field", ...payload });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? `Invalid ${field.label}.`;
  }
  return null;
}

/** Build the exact partial payload sent to updateCandidateAction. */
export function buildAddableFieldUpdatePayload(
  candidateId: string,
  field: CandidateAddableFieldDef,
  rawValue: string
): Record<string, unknown> {
  return {
    id: candidateId,
    ...field.toUpdatePayload(rawValue),
  };
}
