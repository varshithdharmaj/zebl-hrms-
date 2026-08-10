import { z } from "zod";

export const SEMANTIC_VERIFY_PROMPT_VERSION = "resume-semantic-verify-v1";

const decisionTypeSchema = z.enum([
  "experience",
  "project",
  "education",
  "headline",
  "current_role",
  "section",
]);

const decisionActionSchema = z.enum([
  "accept",
  "reject",
  "reclassify",
  "leave_empty",
]);

const proposedSectionSchema = z.enum([
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "summary",
  "other",
]);

export const semanticVerificationDecisionSchema = z.object({
  type: decisionTypeSchema,
  action: decisionActionSchema,
  candidateId: z.string().trim().min(1).max(64).nullable(),
  reason: z.string().trim().min(1).max(500),
  evidence: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
  proposedSection: proposedSectionSchema.nullable(),
});

export const semanticVerificationSchema = z.object({
  version: z.literal(1),
  decisions: z.array(semanticVerificationDecisionSchema).max(30),
});

export type SemanticVerificationDecision = z.infer<
  typeof semanticVerificationDecisionSchema
>;
export type SemanticVerificationResult = z.infer<typeof semanticVerificationSchema>;

export function parseSemanticVerificationOutput(
  raw: unknown
):
  | { ok: true; data: SemanticVerificationResult }
  | { ok: false; error: string } {
  const parsed = semanticVerificationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid semantic verification output.",
    };
  }
  return { ok: true, data: parsed.data };
}
