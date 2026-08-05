import { z } from "zod";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";

/** Metadata validated after file bytes are received server-side. */
export const uploadDocumentMetaSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  documentType: z.nativeEnum(RecruitmentDocumentType),
  fileName: z.string().trim().min(1, "File name is required."),
  mimeType: z.string().trim().min(1, "MIME type is required."),
  sizeBytes: z.number().int().positive("File size must be positive."),
  checksum: z.string().trim().min(1, "Checksum is required."),
});

/** @deprecated Prefer uploadDocumentMetaSchema — storageKey is server-generated. */
export const uploadDocumentSchema = uploadDocumentMetaSchema;

export const renameDocumentSchema = z.object({
  id: z.string().trim().min(1, "Document ID is required."),
  fileName: z.string().trim().min(1, "File name must be at least 1 character."),
});

export const documentIdSchema = z.object({
  id: z.string().trim().min(1, "Document ID is required."),
});

export const replaceResumeSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required."),
  replaceDocumentId: z.string().trim().min(1, "Document ID is required."),
});
