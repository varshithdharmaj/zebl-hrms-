import { z } from "zod";
import { StageCategory } from "@/generated/prisma/enums";

export const createPipelineStageSchema = z.object({
  jobOpeningId: z.string().trim().min(1, "Job Opening ID is required."),
  label: z
    .string()
    .trim()
    .min(1, "Stage name is required.")
    .max(60, "Stage name must be 60 characters or fewer."),
  category: z.nativeEnum(StageCategory),
  afterStageId: z.string().trim().min(1).optional(),
  beforeStageId: z.string().trim().min(1).optional(),
});

export const updatePipelineStageSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
  label: z
    .string()
    .trim()
    .min(1, "Stage name is required.")
    .max(60, "Stage name must be 60 characters or fewer.")
    .optional(),
  category: z.nativeEnum(StageCategory).optional(),
});

export const movePipelineStageSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
  direction: z.enum(["left", "right"]),
});

export const archivePipelineStageSchema = z.object({
  stageId: z.string().trim().min(1, "Stage ID is required."),
});

export type CreatePipelineStageInput = z.infer<typeof createPipelineStageSchema>;
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>;
export type MovePipelineStageInput = z.infer<typeof movePipelineStageSchema>;
export type ArchivePipelineStageInput = z.infer<typeof archivePipelineStageSchema>;
