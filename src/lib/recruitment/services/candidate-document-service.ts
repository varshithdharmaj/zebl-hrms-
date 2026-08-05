import { createHash } from "node:crypto";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import {
  uploadDocumentMetaSchema,
  renameDocumentSchema,
} from "@/lib/validation/schemas/recruitment/documents";
import { buildCandidateDocumentStorageKey } from "@/lib/recruitment/shared/storage-paths";
import {
  getRecruitmentStorage,
  type StorageAdapter,
} from "@/lib/recruitment/storage";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".txt"];
const ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
];

export type DocumentUploadInput = {
  candidateId: string;
  documentType: RecruitmentDocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  content: Buffer | Uint8Array;
};

export type DocumentReplaceInput = {
  candidateId: string;
  /** Resume document being replaced (kept in history). */
  replaceDocumentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  content: Buffer | Uint8Array;
};

function assertValidUploadFile(fileName: string, mimeType: string, sizeBytes: number): void {
  if (sizeBytes > MAX_FILE_SIZE) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "File size exceeds the maximum limit of 15MB."
    );
  }

  const lowerFileName = fileName.toLowerCase();
  const mime = mimeType.trim().toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext));
  const mimeOk = ALLOWED_MIMES.includes(mime) || mime === "application/octet-stream";
  if (!hasAllowedExt || !mimeOk) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "File type is not allowed. Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT."
    );
  }
}

async function assertCandidateManageScope(
  session: SessionUser,
  candidateId: string
): Promise<void> {
  const scope = await RecruitmentScopeEngine.getScope(session);
  RecruitmentScopeEngine.assertCandidateInScope(scope, candidateId);
}

function nextResumeVersion(docs: Array<{ documentType: string; version?: number | null }>): number {
  const resumeVersions = docs
    .filter((d) => d.documentType === RecruitmentDocumentType.resume)
    .map((d) => (typeof d.version === "number" && d.version > 0 ? d.version : 1));
  if (resumeVersions.length === 0) return 1;
  return Math.max(...resumeVersions) + 1;
}

export function createCandidateDocumentService(
  repository: CandidateRepository = prismaCandidateRepository,
  storage: StorageAdapter = getRecruitmentStorage()
) {
  return {
    async uploadDocument(
      session: SessionUser,
      input: DocumentUploadInput
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      await assertCandidateManageScope(session, input.candidateId);
      const actor = toRecruitmentActor(session);

      const parsed = uploadDocumentMetaSchema.parse({
        candidateId: input.candidateId,
        documentType: input.documentType,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
      });

      assertValidUploadFile(parsed.fileName, parsed.mimeType, parsed.sizeBytes);

      if (!input.content || input.content.byteLength === 0) {
        throw new RecruitmentDomainError("REC_VALIDATION", "File content is required.");
      }
      if (input.content.byteLength !== parsed.sizeBytes) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "File size does not match uploaded content."
        );
      }

      const duplicate = await repository.findDocumentByChecksum(
        parsed.candidateId,
        parsed.checksum
      );
      if (duplicate) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "This file has already been uploaded for this candidate.",
          { duplicateDocumentId: duplicate.id }
        );
      }

      const existingDocs = await repository.listCandidateDocuments(parsed.candidateId);
      const activeResumes = existingDocs.filter(
        (d) => d.documentType === RecruitmentDocumentType.resume && d.deletedAt === null
      );
      const isPrimary =
        parsed.documentType === RecruitmentDocumentType.resume && activeResumes.length === 0;

      const storageKey = buildCandidateDocumentStorageKey(parsed.candidateId, parsed.fileName);

      await storage.save(storageKey, input.content, { contentType: parsed.mimeType });

      const events = createAfterCommitBuffer();
      try {
        const documentId = await withRecruitmentTransaction(async (tx) => {
          const { id } = await repository.addDocument(
            parsed.candidateId,
            {
              documentType: parsed.documentType,
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
              sizeBytes: parsed.sizeBytes,
              checksum: parsed.checksum,
              storageKey,
              storagePath: storageKey,
              isPrimary,
              uploadedByUserId: session.id,
              version: 1,
            },
            tx
          );

          if (isPrimary) {
            await repository.setPrimaryResume(id, tx);
          }

          await RecruitmentTimelineService.append(
            {
              entityType: "candidate",
              entityId: parsed.candidateId,
              candidateId: parsed.candidateId,
              eventType: "candidate_document_uploaded",
              summary: `Uploaded document: ${parsed.fileName} (${parsed.documentType})`,
              actorUserId: session.id,
              metadata: {
                documentId: id,
                fileName: parsed.fileName,
                documentType: parsed.documentType,
              },
            },
            tx
          );

          events.enqueue(
            RecruitmentEventFactory.candidateDocumentUploaded(actor, {
              candidateId: parsed.candidateId,
              documentId: id,
              fileName: parsed.fileName,
            })
          );

          return id;
        });

        await events.flush();
        return { id: documentId };
      } catch (error) {
        // Best-effort cleanup of orphan blob if DB write fails.
        try {
          await storage.delete(storageKey);
        } catch {
          /* ignore */
        }
        throw error;
      }
    },

    /**
     * Replace resume: new document row + version bump + primary switch.
     * Previous blob/row remain as history (not overwritten).
     */
    async replaceResume(
      session: SessionUser,
      input: DocumentReplaceInput
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      await assertCandidateManageScope(session, input.candidateId);
      const actor = toRecruitmentActor(session);

      const previous = await repository.getCandidateDocument(input.replaceDocumentId);
      if (!previous || previous.candidateId !== input.candidateId) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Resume to replace was not found.");
      }
      if (previous.documentType !== RecruitmentDocumentType.resume) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only resume documents can be replaced."
        );
      }
      if (previous.deletedAt !== null) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Deleted resumes cannot be replaced. Restore it first or upload a new resume."
        );
      }

      const parsed = uploadDocumentMetaSchema.parse({
        candidateId: input.candidateId,
        documentType: RecruitmentDocumentType.resume,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
      });

      assertValidUploadFile(parsed.fileName, parsed.mimeType, parsed.sizeBytes);

      if (!input.content || input.content.byteLength === 0) {
        throw new RecruitmentDomainError("REC_VALIDATION", "File content is required.");
      }
      if (input.content.byteLength !== parsed.sizeBytes) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "File size does not match uploaded content."
        );
      }

      const duplicate = await repository.findDocumentByChecksum(
        parsed.candidateId,
        parsed.checksum
      );
      if (duplicate) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "This file has already been uploaded for this candidate.",
          { duplicateDocumentId: duplicate.id }
        );
      }

      const existingDocs = await repository.listCandidateDocuments(parsed.candidateId);
      const version = nextResumeVersion(existingDocs);
      const storageKey = buildCandidateDocumentStorageKey(parsed.candidateId, parsed.fileName);

      await storage.save(storageKey, input.content, { contentType: parsed.mimeType });

      const events = createAfterCommitBuffer();
      try {
        const documentId = await withRecruitmentTransaction(async (tx) => {
          const { id } = await repository.addDocument(
            parsed.candidateId,
            {
              documentType: RecruitmentDocumentType.resume,
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
              sizeBytes: parsed.sizeBytes,
              checksum: parsed.checksum,
              storageKey,
              storagePath: storageKey,
              isPrimary: true,
              uploadedByUserId: session.id,
              version,
            },
            tx
          );

          await repository.setPrimaryResume(id, tx);

          await RecruitmentTimelineService.append(
            {
              entityType: "candidate",
              entityId: parsed.candidateId,
              candidateId: parsed.candidateId,
              eventType: "candidate_document_uploaded",
              summary: `Replaced resume: ${parsed.fileName} (v${version})`,
              actorUserId: session.id,
              metadata: {
                documentId: id,
                replacedDocumentId: previous.id,
                fileName: parsed.fileName,
                documentType: RecruitmentDocumentType.resume,
                version,
              },
            },
            tx
          );

          events.enqueue(
            RecruitmentEventFactory.candidateDocumentUploaded(actor, {
              candidateId: parsed.candidateId,
              documentId: id,
              fileName: parsed.fileName,
            })
          );

          return id;
        });

        await events.flush();
        return { id: documentId };
      } catch (error) {
        try {
          await storage.delete(storageKey);
        } catch {
          /* ignore */
        }
        throw error;
      }
    },

    async renameDocument(
      session: SessionUser,
      input: { id: string; fileName: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const parsed = renameDocumentSchema.parse(input);

      const doc = await repository.getCandidateDocument(parsed.id);
      if (!doc) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document not found.");
      }
      await assertCandidateManageScope(session, doc.candidateId);

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        const oldName = doc.fileName;
        await repository.updateCandidateDocument(
          parsed.id,
          { ...doc, fileName: parsed.fileName },
          tx
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: doc.candidateId,
            candidateId: doc.candidateId,
            eventType: "candidate_document_renamed",
            summary: `Renamed document from "${oldName}" to "${parsed.fileName}"`,
            actorUserId: session.id,
            metadata: { documentId: parsed.id, oldName, newName: parsed.fileName },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateDocumentUpdated(actor, {
            candidateId: doc.candidateId,
            documentId: parsed.id,
            patch: { fileName: parsed.fileName },
          })
        );
      });

      await events.flush();
    },

    async deleteDocument(session: SessionUser, documentId: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const doc = await repository.getCandidateDocument(documentId);
      if (!doc) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document not found.");
      }
      await assertCandidateManageScope(session, doc.candidateId);

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        // Soft-delete DB row only — blob retained for restore / audit.
        await repository.softDeleteDocument(documentId, tx);

        if (doc.isPrimary) {
          await repository.updateCandidateDocument(
            documentId,
            { ...doc, isPrimary: false },
            tx
          );
        }

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: doc.candidateId,
            candidateId: doc.candidateId,
            eventType: "candidate_document_deleted",
            summary: `Deleted document: ${doc.fileName}`,
            actorUserId: session.id,
            metadata: { documentId, fileName: doc.fileName },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateDocumentDeleted(actor, {
            candidateId: doc.candidateId,
            documentId,
          })
        );
      });

      await events.flush();
    },

    async restoreDocument(session: SessionUser, documentId: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const doc = await repository.getCandidateDocument(documentId);
      if (!doc) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document not found.");
      }
      await assertCandidateManageScope(session, doc.candidateId);

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.restoreCandidateDocument(documentId, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: doc.candidateId,
            candidateId: doc.candidateId,
            eventType: "candidate_document_restored",
            summary: `Restored document: ${doc.fileName}`,
            actorUserId: session.id,
            metadata: { documentId, fileName: doc.fileName },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateDocumentUpdated(actor, {
            candidateId: doc.candidateId,
            documentId,
            patch: { deletedAt: null },
          })
        );
      });

      await events.flush();
    },

    async setPrimaryResume(session: SessionUser, documentId: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const doc = await repository.getCandidateDocument(documentId);
      if (!doc) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document not found.");
      }
      await assertCandidateManageScope(session, doc.candidateId);

      if (doc.documentType !== RecruitmentDocumentType.resume) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only resume documents can be marked as primary."
        );
      }

      if (doc.deletedAt !== null) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Deleted documents cannot be set as primary."
        );
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.setPrimaryResume(documentId, tx);

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: doc.candidateId,
            candidateId: doc.candidateId,
            eventType: "candidate_primary_resume_changed",
            summary: `Set primary resume: ${doc.fileName}`,
            actorUserId: session.id,
            metadata: { documentId, fileName: doc.fileName },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateDocumentUpdated(actor, {
            candidateId: doc.candidateId,
            documentId,
            patch: { isPrimary: true },
          })
        );
      });

      await events.flush();
    },

    async getDocumentContent(
      session: SessionUser,
      documentId: string
    ): Promise<{ content: Buffer; fileName: string; mimeType: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const doc = await repository.getCandidateDocument(documentId);
      if (!doc || doc.deletedAt !== null) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document not found.");
      }
      await assertCandidateManageScope(session, doc.candidateId);

      const exists = await storage.exists(doc.storageKey);
      if (!exists) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Document file not found in storage.");
      }

      const content = await storage.read(doc.storageKey);
      return {
        content,
        fileName: doc.fileName as string,
        mimeType: (doc.mimeType as string) || "application/octet-stream",
      };
    },

    async getCandidateDocuments(
      session: SessionUser,
      candidateId: string
    ): Promise<Record<string, unknown>[]> {
      const scope = await RecruitmentScopeEngine.getScope(session);
      RecruitmentScopeEngine.assertCandidateInScope(scope, candidateId);

      return repository.listCandidateDocuments(candidateId);
    },
  };
}

/** SHA-256 hex digest for upload checksums. */
export function checksumBuffer(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
