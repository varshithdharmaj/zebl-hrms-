import { z } from "zod";
import type { CandidateEnrichmentInsightContent, CandidateEnrichmentOutput } from "./types";
import { CANDIDATE_ENRICHMENT_CONTENT_KIND } from "./types";

export const candidateEnrichmentOutputSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  headline: z.string().trim().min(1).max(200),
  strengths: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  missingInformation: z.array(z.string().trim().min(1).max(200)).max(20),
  interviewTopics: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
});

export type ParsedCandidateEnrichmentOutput = z.infer<
  typeof candidateEnrichmentOutputSchema
>;

const fieldStatusSchema = z.object({
  summary: z.enum(["filled", "empty"]),
  headline: z.enum(["filled", "empty"]),
  githubUrl: z.enum(["filled", "empty"]),
  portfolioUrl: z.enum(["filled", "empty"]),
  linkedinUrl: z.enum(["filled", "empty"]),
  currentCompany: z.enum(["filled", "empty"]),
  currentTitle: z.enum(["filled", "empty"]),
  experienceYears: z.enum(["filled", "empty"]),
  experience: z.enum(["filled", "empty"]),
  education: z.enum(["filled", "empty"]),
  skills: z.enum(["filled", "empty"]),
  projects: z.enum(["filled", "empty"]),
  certifications: z.enum(["filled", "empty"]),
  noticePeriod: z.enum(["filled", "empty"]),
  expectedCtc: z.enum(["filled", "empty"]),
  currentCtc: z.enum(["filled", "empty"]),
  earliestJoinDate: z.enum(["filled", "empty"]),
  availability: z.enum(["filled", "empty"]),
});

export const candidateEnrichmentInsightContentSchema = z.object({
  version: z.literal(1),
  kind: z.literal(CANDIDATE_ENRICHMENT_CONTENT_KIND),
  promptVersion: z.string().min(1),
  documentId: z.string().nullable(),
  sourceDraftId: z.string().nullable(),
  /** Optional for legacy insights generated before freshness hardening. */
  inputFingerprint: z.string().trim().min(1).nullable().optional(),
  fieldStatus: fieldStatusSchema,
  enrichment: candidateEnrichmentOutputSchema,
  applied: z.object({
    summary: z.boolean(),
    headline: z.boolean(),
  }),
});

export function parseEnrichmentOutput(
  raw: unknown
):
  | { ok: true; data: CandidateEnrichmentOutput }
  | { ok: false; error: string } {
  const parsed = candidateEnrichmentOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid enrichment output." };
  }
  return { ok: true, data: parsed.data };
}

export function parseEnrichmentInsightContent(
  raw: unknown
):
  | { ok: true; data: CandidateEnrichmentInsightContent }
  | { ok: false; error: string } {
  const parsed = candidateEnrichmentInsightContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid enrichment insight content.",
    };
  }
  return { ok: true, data: parsed.data };
}

/** Reject outputs that invent numeric CTC / notice values. */
export function enrichmentContainsSensitiveInventions(
  output: CandidateEnrichmentOutput
): boolean {
  const corpus = [
    output.summary,
    output.headline,
    ...output.strengths,
    ...output.interviewTopics,
  ]
    .join(" ")
    .toLowerCase();

  // Invented compensation / notice in generated prose (missingInformation may name the gap).
  const banned = [
    /\b\d+\s*(lpa|lakhs?|lakh)\b/i,
    /\bctc\s*[:=]\s*\d+/i,
    /\bnotice\s*period\s*[:=]\s*\d+/i,
    /\bjoining\s*(on|date)\s*[:=]/i,
  ];
  return banned.some((re) => re.test(corpus));
}
