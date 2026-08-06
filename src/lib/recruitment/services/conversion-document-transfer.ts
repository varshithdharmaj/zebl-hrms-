import {
  buildEmployeeDocumentStorageKey,
  sanitizeStorageFileName,
} from "@/lib/recruitment/shared/storage-paths";
import type { StorageAdapter } from "@/lib/recruitment/storage";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

export type TransferredEmployeeDocument = {
  kind: "resume" | "offer_letter";
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string;
  sourceRef: string;
};

type TxClient = RepositoryTx & {
  candidateDocument: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      fileName: string;
      mimeType: string | null;
      sizeBytes: number | null;
      storageKey: string;
    } | null>;
  };
};

/**
 * Copy primary resume (+ optional offer PDF) into employee storage.
 * Candidate documents are left untouched. Metadata is returned for snapshot.mappedFields.
 * No new EmployeeDocument table — reuses conversion snapshot + recruitment storage.
 */
export async function copyRecruitmentDocsToEmployee(args: {
  tx: TxClient;
  storage: StorageAdapter;
  candidateId: string;
  employeeId: number;
  offerPdfKey?: string | null;
}): Promise<TransferredEmployeeDocument[]> {
  const transferred: TransferredEmployeeDocument[] = [];

  const primaryResume = await args.tx.candidateDocument.findFirst({
    where: {
      candidateId: args.candidateId,
      isPrimary: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (primaryResume) {
    const content = await args.storage.read(primaryResume.storageKey);
    const storageKey = buildEmployeeDocumentStorageKey(
      args.employeeId,
      primaryResume.fileName
    );
    await args.storage.save(storageKey, content, {
      contentType: primaryResume.mimeType ?? undefined,
    });
    transferred.push({
      kind: "resume",
      fileName: primaryResume.fileName,
      mimeType: primaryResume.mimeType,
      sizeBytes: primaryResume.sizeBytes,
      storageKey,
      sourceRef: primaryResume.id,
    });
  }

  if (args.offerPdfKey) {
    try {
      const content = await args.storage.read(args.offerPdfKey);
      const fileName = sanitizeStorageFileName(
        args.offerPdfKey.split("/").pop() || "offer-letter.pdf"
      );
      const storageKey = buildEmployeeDocumentStorageKey(args.employeeId, fileName);
      await args.storage.save(storageKey, content, { contentType: "application/pdf" });
      transferred.push({
        kind: "offer_letter",
        fileName,
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        storageKey,
        sourceRef: args.offerPdfKey,
      });
    } catch {
      // Offer PDF missing from storage — skip without failing conversion.
    }
  }

  return transferred;
}
