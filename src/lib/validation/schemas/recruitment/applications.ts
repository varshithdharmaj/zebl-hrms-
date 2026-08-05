import { z } from "zod";
import {
  ApplicationPriority,
  ApplicationStatus,
  RecruitmentPipelineStage,
  CandidateSource,
} from "@/generated/prisma/enums";

export const createApplicationSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  jobOpeningId: z.string().trim().min(1, "Job Opening ID is required."),
  assignedRecruiterUserId: z.string().trim().nullable().optional(),
  assignedManagerEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  priority: z.nativeEnum(ApplicationPriority).optional().default(ApplicationPriority.normal),
  source: z.nativeEnum(CandidateSource).optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial().extend({
  id: z.string().trim().min(1, "Application ID is required."),
});

export const applicationIdSchema = z.object({
  id: z.string().trim().min(1, "Application ID is required."),
});

export const moveStageSchema = z.object({
  id: z.string().trim().min(1, "Application ID is required."),
  stage: z.nativeEnum(RecruitmentPipelineStage),
  note: z.string().trim().optional(),
});

export const rejectApplicationSchema = z.object({
  id: z.string().trim().min(1, "Application ID is required."),
  reason: z.string().trim().min(1, "Reason is required."),
});

export const withdrawApplicationSchema = z.object({
  id: z.string().trim().min(1, "Application ID is required."),
  reason: z.string().trim().min(1, "Reason is required."),
});

export const updateApplicationAssessmentSchema = z.object({
  applicationId: z.string().trim().min(1, "Application ID is required."),
  assessment: z
    .string()
    .trim()
    .max(5000, "Assessment must be 5000 characters or fewer.")
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export type UpdateApplicationAssessmentInput = z.infer<
  typeof updateApplicationAssessmentSchema
>;
