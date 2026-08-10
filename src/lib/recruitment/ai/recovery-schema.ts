import { z } from "zod";
import {
  RECOVERY_FIELDS,
  RESUME_FIELD_RECOVERY_CONTENT_KIND,
  RESUME_FIELD_RECOVERY_PROMPT_VERSION,
  type RecoveryFieldKey,
  type ResumeFieldRecoveryInsightContent,
} from "./recovery-types";

const recoveryFieldSchema = z.enum(
  RECOVERY_FIELDS as unknown as [RecoveryFieldKey, ...RecoveryFieldKey[]]
);

const experienceValueSchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().optional(),
  startDate: z.string().trim().max(40).nullable().optional(),
  endDate: z.string().trim().max(40).nullable().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
});

const educationValueSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  degree: z.string().trim().max(120).nullable().optional(),
  field: z.string().trim().max(120).nullable().optional(),
  startYear: z.number().int().min(1950).max(2100).nullable().optional(),
  endYear: z.number().int().min(1950).max(2100).nullable().optional(),
  grade: z.string().trim().max(80).nullable().optional(),
});

const projectValueSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000).nullable().optional(),
  techStack: z.string().trim().max(500).nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
  duration: z.string().trim().max(120).nullable().optional(),
});

const certificationValueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().max(200).nullable().optional(),
  issuedAt: z.string().trim().max(40).nullable().optional(),
  credentialId: z.string().trim().max(120).nullable().optional(),
  credentialUrl: z.string().trim().max(500).nullable().optional(),
});

const scalarValueSchema = z.string().trim().min(1).max(4000);

export const recoveryProposalRawSchema = z.object({
  field: recoveryFieldSchema,
  value: z.unknown(),
  confidence: z.enum(["high", "medium"]),
  evidence: z.string().trim().min(3).max(500),
});

export const recoveryModelOutputSchema = z.object({
  proposals: z.array(recoveryProposalRawSchema).max(25),
});

const SENSITIVE_TEXT_RE =
  /\b(ctc|lpa|notice\s*period|expected\s*salary|current\s*salary|availability|joining\s*date|immediate\s*joiner)\b/i;

const DENIED_FIELDS = new Set([
  "email",
  "phone",
  "currentCtc",
  "expectedCtc",
  "noticePeriod",
  "noticePeriodDays",
  "availability",
  "availabilityNotes",
  "earliestJoinDate",
  "status",
  "source",
]);

function validateValueForField(
  field: RecoveryFieldKey,
  value: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (field === "experience") {
    const parsed = experienceValueSchema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid experience." };
  }
  if (field === "education") {
    const parsed = educationValueSchema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid education." };
  }
  if (field === "project") {
    const parsed = projectValueSchema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid project." };
  }
  if (field === "certification") {
    const parsed = certificationValueSchema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid certification." };
  }
  if (field === "skill") {
    if (typeof value === "object" && value && "name" in value) {
      const name = String((value as { name: unknown }).name ?? "").trim();
      const parsed = scalarValueSchema.safeParse(name);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: "Invalid skill." };
    }
    const parsed = scalarValueSchema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: "Invalid skill." };
  }
  const parsed = scalarValueSchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: `Invalid ${field}.` };
}

export function parseRecoveryModelOutput(input: unknown):
  | {
      ok: true;
      data: Array<{
        field: RecoveryFieldKey;
        value: unknown;
        confidence: "high" | "medium";
        evidence: string;
      }>;
    }
  | { ok: false; error: string } {
  // Soft-parse: reject only when envelope is malformed. Drop bad rows.
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid recovery output." };
  }
  const proposalsRaw = (input as { proposals?: unknown }).proposals;
  if (!Array.isArray(proposalsRaw)) {
    return { ok: false, error: "Invalid recovery output." };
  }
  if (proposalsRaw.length > 25) {
    return { ok: false, error: "Too many recovery proposals." };
  }

  const out: Array<{
    field: RecoveryFieldKey;
    value: unknown;
    confidence: "high" | "medium";
    evidence: string;
  }> = [];

  for (const raw of proposalsRaw) {
    const row = recoveryProposalRawSchema.safeParse(raw);
    if (!row.success) continue;
    if (DENIED_FIELDS.has(row.data.field)) continue;
    if (SENSITIVE_TEXT_RE.test(row.data.evidence)) continue;
    if (SENSITIVE_TEXT_RE.test(JSON.stringify(row.data.value))) continue;
    const validated = validateValueForField(row.data.field, row.data.value);
    if (!validated.ok) continue;
    out.push({
      field: row.data.field,
      value: validated.value,
      confidence: row.data.confidence,
      evidence: row.data.evidence,
    });
  }

  return { ok: true, data: out };
}

export const recoveryInsightContentSchema = z.object({
  version: z.literal(1),
  kind: z.literal(RESUME_FIELD_RECOVERY_CONTENT_KIND),
  promptVersion: z.string().min(1),
  documentId: z.string().nullable(),
  sourceDraftId: z.string().nullable(),
  inputFingerprint: z.string().min(1),
  resumeTextHash: z.string().min(1),
  eligibleFields: z.array(recoveryFieldSchema),
  proposals: z.array(
    z.object({
      id: z.string().min(1),
      field: recoveryFieldSchema,
      value: z.unknown(),
      confidence: z.enum(["high", "medium"]),
      evidence: z.string().min(1),
      applied: z.boolean(),
    })
  ),
});

export function parseRecoveryInsightContent(
  input: unknown
):
  | { ok: true; data: ResumeFieldRecoveryInsightContent }
  | { ok: false; error: string } {
  const parsed = recoveryInsightContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid recovery insight content.",
    };
  }
  if (parsed.data.promptVersion !== RESUME_FIELD_RECOVERY_PROMPT_VERSION) {
    return { ok: false, error: "Unsupported recovery prompt version." };
  }
  return { ok: true, data: parsed.data };
}
