import { z } from "zod";

export const addCandidateTagSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  tagName: z.string().trim().min(1, "Tag name is required.").max(40, "Tag name must be 40 characters or fewer."),
});

export const removeCandidateTagSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  tagId: z.string().trim().min(1, "Tag ID is required."),
});

export type AddCandidateTagInput = z.infer<typeof addCandidateTagSchema>;
export type RemoveCandidateTagInput = z.infer<typeof removeCandidateTagSchema>;
