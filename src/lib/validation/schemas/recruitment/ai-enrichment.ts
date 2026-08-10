import { z } from "zod";

export const generateCandidateAiEnrichmentSchema = z.object({
  candidateId: z.string().min(1),
  sourceDraftId: z.string().min(1),
  force: z.boolean().optional(),
});

export const dismissCandidateAiEnrichmentSchema = z.object({
  candidateId: z.string().min(1),
  insightId: z.string().min(1),
});

export const acceptCandidateAiEnrichmentSchema = z.object({
  candidateId: z.string().min(1),
  insightId: z.string().min(1),
  acceptSummary: z.boolean().optional(),
  acceptHeadline: z.boolean().optional(),
  /** Required when Candidate already has a non-empty professionalSummary. */
  replaceSummary: z.boolean().optional(),
  /** Required when Candidate already has a non-empty headline. */
  replaceHeadline: z.boolean().optional(),
  editedSummary: z.string().trim().max(4000).nullable().optional(),
  editedHeadline: z.string().trim().max(200).nullable().optional(),
});

export type GenerateCandidateAiEnrichmentInput = z.infer<
  typeof generateCandidateAiEnrichmentSchema
>;
export type DismissCandidateAiEnrichmentInput = z.infer<
  typeof dismissCandidateAiEnrichmentSchema
>;
export type AcceptCandidateAiEnrichmentInput = z.infer<
  typeof acceptCandidateAiEnrichmentSchema
>;
