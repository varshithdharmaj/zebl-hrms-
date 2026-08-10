import { z } from "zod";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";

const requiredText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`);

export const submitHiringDecisionSchema = z.object({
  applicationId: z.string().trim().min(1, "Application ID is required."),
  outcome: z.nativeEnum(HiringDecisionOutcome),
  rationale: requiredText("Rationale"),
  strengths: requiredText("Strengths"),
  concerns: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  salaryRecommendation: z.coerce.number().positive().optional().nullable(),
  currency: z.string().trim().min(1).optional().nullable(),
});

export type SubmitHiringDecisionInput = z.input<typeof submitHiringDecisionSchema>;
export type SubmitHiringDecisionData = z.output<typeof submitHiringDecisionSchema>;
