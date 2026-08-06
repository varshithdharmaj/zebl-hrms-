import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyRecruitmentDocsToEmployee } from "@/lib/recruitment/services/conversion-document-transfer";
import type { StorageAdapter } from "@/lib/recruitment/storage";

describe("copyRecruitmentDocsToEmployee", () => {
  let storage: StorageAdapter;
  let tx: {
    candidateDocument: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    storage = {
      save: vi.fn(async () => undefined),
      read: vi.fn(async (key: string) => {
        if (key.includes("missing")) throw new Error("not found");
        return Buffer.from(`content:${key}`);
      }),
      delete: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
      getMetadata: vi.fn(async () => null),
    };
    tx = {
      candidateDocument: {
        findFirst: vi.fn(async () => ({
          id: "doc-resume-1",
          fileName: "resume.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12,
          storageKey: "candidates/cand-1/documents/resume.pdf",
        })),
      },
    };
  });

  it("copies primary resume and offer PDF without deleting candidate docs", async () => {
    const transferred = await copyRecruitmentDocsToEmployee({
      tx: tx as never,
      storage,
      candidateId: "cand-1",
      employeeId: 101,
      offerPdfKey: "offers/off-1/pdf/offer.pdf",
    });

    expect(transferred).toHaveLength(2);
    expect(transferred[0]?.kind).toBe("resume");
    expect(transferred[0]?.sourceRef).toBe("doc-resume-1");
    expect(transferred[0]?.storageKey).toMatch(/^employees\/101\/documents\//);
    expect(transferred[1]?.kind).toBe("offer_letter");
    expect(storage.save).toHaveBeenCalledTimes(2);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(tx.candidateDocument.findFirst).toHaveBeenCalled();
  });

  it("skips missing offer PDF without failing", async () => {
    const transferred = await copyRecruitmentDocsToEmployee({
      tx: tx as never,
      storage,
      candidateId: "cand-1",
      employeeId: 101,
      offerPdfKey: "offers/off-1/pdf/missing.pdf",
    });

    expect(transferred).toHaveLength(1);
    expect(transferred[0]?.kind).toBe("resume");
  });

  it("returns empty when no primary resume and no offer PDF", async () => {
    tx.candidateDocument.findFirst = vi.fn(async () => null);
    const transferred = await copyRecruitmentDocsToEmployee({
      tx: tx as never,
      storage,
      candidateId: "cand-1",
      employeeId: 101,
      offerPdfKey: null,
    });
    expect(transferred).toEqual([]);
    expect(storage.save).not.toHaveBeenCalled();
  });
});
