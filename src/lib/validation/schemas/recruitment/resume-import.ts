import { z } from "zod";

export const createResumeImportDraftSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  documentId: z.string().trim().min(1).optional().nullable(),
});

export const resumeImportDraftIdSchema = z.object({
  draftId: z.string().trim().min(1, "Draft ID is required."),
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
});

const scalarDecisionSchema = z.object({
  key: z.string().trim().min(1),
  action: z.enum(["accept", "ignore"]),
  editedValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const sectionDecisionSchema = z.object({
  section: z.enum([
    "experiences",
    "educations",
    "skills",
    "projects",
    "certifications",
  ]),
  action: z.enum(["accept", "ignore"]),
  editedRows: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const applyResumeImportSchema = z.object({
  draftId: z.string().trim().min(1),
  candidateId: z.string().trim().min(1),
  scalarDecisions: z.array(scalarDecisionSchema),
  sectionDecisions: z.array(sectionDecisionSchema),
});

/** Prepare V1 profile merge after a resume document upload. */
export const prepareCandidateResumeMergeSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  documentId: z.string().trim().min(1, "Document ID is required."),
});

/**
 * Apply V1 resume merge in one transaction.
 * Conflict selections: key → "current" | "parsed".
 * Server re-runs the merge engine; client only supplies conflict choices.
 */
export const mergeCandidateResumeSchema = z.object({
  draftId: z.string().trim().min(1, "Draft ID is required."),
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  conflictSelections: z
    .record(z.string(), z.enum(["current", "parsed"]))
    .default({}),
});
