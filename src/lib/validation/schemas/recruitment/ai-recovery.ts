import { z } from "zod";

export const generateCandidateAiRecoverySchema = z.object({
  candidateId: z.string().min(1),
  sourceDraftId: z.string().min(1),
  force: z.boolean().optional(),
});

export const dismissCandidateAiRecoverySchema = z.object({
  candidateId: z.string().min(1),
  insightId: z.string().min(1),
});

export const acceptCandidateAiRecoverySchema = z.object({
  candidateId: z.string().min(1),
  insightId: z.string().min(1),
  proposalIds: z.array(z.string().min(1)).min(1).max(25),
  editedValues: z.record(z.string(), z.unknown()).optional(),
});

export type GenerateCandidateAiRecoveryInput = z.infer<
  typeof generateCandidateAiRecoverySchema
>;
export type DismissCandidateAiRecoveryInput = z.infer<
  typeof dismissCandidateAiRecoverySchema
>;
export type AcceptCandidateAiRecoveryInput = z.infer<
  typeof acceptCandidateAiRecoverySchema
>;
