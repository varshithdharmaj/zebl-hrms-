import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import {
  checksumBuffer,
  createCandidateDocumentService,
} from "@/lib/recruitment/services/candidate-document-service";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import {
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
} from "@/lib/recruitment/storage";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => {
    const events: unknown[] = [];
    return {
      enqueue: (e: unknown) => events.push(e),
      flush: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

function makeContent(text = "resume-bytes"): Buffer {
  return Buffer.from(text, "utf8");
}

describe("LocalStorageAdapter", () => {
  it("saves, reads, exists, metadata, and deletes real files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "rec-storage-"));
    try {
      const adapter = createLocalStorageAdapter(root);
      const key = "candidates/c1/documents/a.pdf";
      const bytes = Buffer.from("%PDF-1.4 mock");

      await adapter.save(key, bytes, { contentType: "application/pdf" });
      expect(await adapter.exists(key)).toBe(true);
      expect(await adapter.read(key)).toEqual(bytes);

      const meta = await adapter.getMetadata(key);
      expect(meta?.sizeBytes).toBe(bytes.byteLength);

      await adapter.delete(key);
      expect(await adapter.exists(key)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects path traversal keys", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "rec-storage-"));
    try {
      const adapter = createLocalStorageAdapter(root);
      await expect(adapter.save("../escape.txt", Buffer.from("x"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("CandidateDocumentService storage lifecycle", () => {
  let mockRepo: CandidateRepository;
  let storage: ReturnType<typeof createMemoryStorageAdapter>;
  let docs: Array<Record<string, unknown>>;

  beforeEach(() => {
    storage = createMemoryStorageAdapter();
    docs = [];

    mockRepo = {
      addDocument: vi.fn(async (_candidateId, data) => {
        const id = `doc-${docs.length + 1}`;
        const row = { id, candidateId: "cand-1", deletedAt: null, ...data };
        docs.push(row);
        return { id };
      }),
      setPrimaryResume: vi.fn(async (documentId) => {
        for (const d of docs) {
          if (d.candidateId === "cand-1") d.isPrimary = d.id === documentId;
        }
      }),
      softDeleteDocument: vi.fn(async (documentId) => {
        const doc = docs.find((d) => d.id === documentId);
        if (doc) doc.deletedAt = new Date();
      }),
      getCandidateDocument: vi.fn(async (documentId) => {
        return docs.find((d) => d.id === documentId) ?? null;
      }),
      updateCandidateDocument: vi.fn(async (documentId, patch) => {
        const doc = docs.find((d) => d.id === documentId);
        if (doc) Object.assign(doc, patch);
      }),
      restoreCandidateDocument: vi.fn(async (documentId) => {
        const doc = docs.find((d) => d.id === documentId);
        if (doc) doc.deletedAt = null;
      }),
      listCandidateDocuments: vi.fn(async () => docs),
      findDocumentByChecksum: vi.fn(async (_candidateId, checksum) => {
        return (
          docs.find((d) => d.checksum === checksum && d.deletedAt === null) ?? null
        );
      }),
    } as unknown as CandidateRepository;

    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue({
      mode: "unrestricted",
      jobOpeningIds: [],
      applicationIds: [],
      candidateIds: [],
      isRecruiterOnJob: false,
      isHiringManager: false,
      isTeamLead: false,
      isInterviewer: false,
    } as never);
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(() => undefined);
  });

  it("uploads real bytes and returns content for preview/download", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const content = makeContent("hello-resume");
    const checksum = checksumBuffer(content);

    const { id } = await service.uploadDocument(hrSession, {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      checksum,
      content,
    });

    expect(id).toBe("doc-1");
    expect(mockRepo.addDocument).toHaveBeenCalledWith(
      "cand-1",
      expect.objectContaining({
        isPrimary: true,
        storageKey: expect.stringMatching(/^candidates\/cand-1\/documents\//),
        checksum,
      }),
      expect.anything()
    );

    const storedKey = (docs[0] as { storageKey: string }).storageKey;
    expect(await storage.exists(storedKey)).toBe(true);
    expect(await storage.read(storedKey)).toEqual(content);

    const loaded = await service.getDocumentContent(hrSession, id);
    expect(loaded.content.toString("utf8")).toBe("hello-resume");
    expect(loaded.mimeType).toBe("application/pdf");
    expect(loaded.fileName).toBe("resume.pdf");
  });

  it("replace increments version, switches primary, keeps previous blob", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const v1 = makeContent("version-1");
    const v2 = makeContent("version-2");

    const first = await service.uploadDocument(hrSession, {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "resume-v1.pdf",
      mimeType: "application/pdf",
      sizeBytes: v1.byteLength,
      checksum: checksumBuffer(v1),
      content: v1,
    });

    const second = await service.replaceResume(hrSession, {
      candidateId: "cand-1",
      replaceDocumentId: first.id,
      fileName: "resume-v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: v2.byteLength,
      checksum: checksumBuffer(v2),
      content: v2,
    });

    expect(second.id).toBe("doc-2");
    expect(docs[0].isPrimary).toBe(false);
    expect(docs[1].isPrimary).toBe(true);
    expect(docs[1].version).toBe(2);

    const key1 = docs[0].storageKey as string;
    const key2 = docs[1].storageKey as string;
    expect(key1).not.toBe(key2);
    expect(await storage.exists(key1)).toBe(true);
    expect(await storage.exists(key2)).toBe(true);
    expect(await storage.read(key1)).toEqual(v1);
    expect(await storage.read(key2)).toEqual(v2);
  });

  it("soft delete keeps blob and blocks content read", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const content = makeContent("soft-delete-me");
    const { id } = await service.uploadDocument(hrSession, {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      checksum: checksumBuffer(content),
      content,
    });

    const key = docs[0].storageKey as string;
    await service.deleteDocument(hrSession, id);

    expect(mockRepo.softDeleteDocument).toHaveBeenCalledWith(id, expect.anything());
    expect(await storage.exists(key)).toBe(true);
    await expect(service.getDocumentContent(hrSession, id)).rejects.toThrow(
      RecruitmentDomainError
    );
  });

  it("validates candidate scope before upload", async () => {
    vi.spyOn(RecruitmentScopeEngine, "assertCandidateInScope").mockImplementation(() => {
      throw new RecruitmentDomainError("REC_FORBIDDEN_SCOPE", "Candidate outside recruitment scope.");
    });

    const service = createCandidateDocumentService(mockRepo, storage);
    const content = makeContent("scoped");
    await expect(
      service.uploadDocument(hrSession, {
        candidateId: "cand-out",
        documentType: RecruitmentDocumentType.resume,
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        checksum: checksumBuffer(content),
        content,
      })
    ).rejects.toMatchObject({ code: "REC_FORBIDDEN_SCOPE" });
  });

  it("throws on oversized upload", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const content = Buffer.alloc(20 * 1024 * 1024, 1);
    await expect(
      service.uploadDocument(hrSession, {
        candidateId: "cand-1",
        documentType: RecruitmentDocumentType.resume,
        fileName: "huge.pdf",
        mimeType: "application/pdf",
        sizeBytes: content.byteLength,
        checksum: checksumBuffer(content),
        content,
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("throws on duplicate checksum", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const content = makeContent("dup");
    const input = {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      checksum: checksumBuffer(content),
      content,
    };
    await service.uploadDocument(hrSession, input);
    await expect(service.uploadDocument(hrSession, input)).rejects.toThrow(
      RecruitmentDomainError
    );
  });

  it("set primary switches among resumes", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const a = makeContent("a");
    const b = makeContent("b");

    const first = await service.uploadDocument(hrSession, {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: a.byteLength,
      checksum: checksumBuffer(a),
      content: a,
    });

    // Second upload is not primary by default
    docs.push({
      id: "doc-2",
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "b.pdf",
      mimeType: "application/pdf",
      sizeBytes: b.byteLength,
      checksum: checksumBuffer(b),
      storageKey: "candidates/cand-1/documents/b.pdf",
      isPrimary: false,
      deletedAt: null,
      version: 1,
    });
    await storage.save("candidates/cand-1/documents/b.pdf", b);

    await service.setPrimaryResume(hrSession, "doc-2");
    expect(mockRepo.setPrimaryResume).toHaveBeenCalledWith("doc-2", expect.anything());
    expect(docs.find((d) => d.id === first.id)?.isPrimary).toBe(false);
    expect(docs.find((d) => d.id === "doc-2")?.isPrimary).toBe(true);
  });

  it("restore clears deletedAt without touching storage", async () => {
    const service = createCandidateDocumentService(mockRepo, storage);
    const content = makeContent("restore-me");
    const { id } = await service.uploadDocument(hrSession, {
      candidateId: "cand-1",
      documentType: RecruitmentDocumentType.resume,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      checksum: checksumBuffer(content),
      content,
    });

    const key = docs[0].storageKey as string;
    await service.deleteDocument(hrSession, id);
    await service.restoreDocument(hrSession, id);

    expect(mockRepo.restoreCandidateDocument).toHaveBeenCalledWith(id, expect.anything());
    expect(docs[0].deletedAt).toBeNull();
    expect(await storage.exists(key)).toBe(true);
  });
});
