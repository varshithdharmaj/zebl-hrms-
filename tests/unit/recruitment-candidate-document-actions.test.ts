import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";
import {
  uploadCandidateDocumentAction,
  replaceCandidateResumeAction,
  renameCandidateDocumentAction,
  deleteCandidateDocumentAction,
  restoreCandidateDocumentAction,
  setPrimaryResumeAction,
} from "@/actions/recruitment-documents";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
    userId: "user-hr",
  }),
  requireRecruitmentAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
    userId: "user-hr",
  }),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const mockUploadDocument = vi.fn(async () => ({ id: "doc-1" }));
const mockReplaceResume = vi.fn(async () => ({ id: "doc-2" }));
const mockRenameDocument = vi.fn(async () => undefined);
const mockDeleteDocument = vi.fn(async () => undefined);
const mockRestoreDocument = vi.fn(async () => undefined);
const mockSetPrimaryResume = vi.fn(async () => undefined);

vi.mock("@/lib/recruitment/services/candidate-document-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recruitment/services/candidate-document-service")
  >("@/lib/recruitment/services/candidate-document-service");
  return {
    checksumBuffer: actual.checksumBuffer,
    createCandidateDocumentService: () => ({
      uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
      replaceResume: (...args: unknown[]) => mockReplaceResume(...args),
      renameDocument: (...args: unknown[]) => mockRenameDocument(...args),
      deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
      restoreDocument: (...args: unknown[]) => mockRestoreDocument(...args),
      setPrimaryResume: (...args: unknown[]) => mockSetPrimaryResume(...args),
    }),
  };
});

function buildUploadFormData(overrides?: {
  fileName?: string;
  content?: string;
  candidateId?: string;
  documentType?: RecruitmentDocumentType;
}): FormData {
  const formData = new FormData();
  const content = overrides?.content ?? "resume content";
  const file = new File([content], overrides?.fileName ?? "resume.pdf", {
    type: "application/pdf",
  });
  formData.set("file", file);
  formData.set("candidateId", overrides?.candidateId ?? "cand-1");
  formData.set(
    "documentType",
    overrides?.documentType ?? RecruitmentDocumentType.resume
  );
  return formData;
}

describe("Candidate Document Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload document via FormData action", async () => {
    const res = await uploadCandidateDocumentAction({}, buildUploadFormData());

    expect(res.success).toBeDefined();
    expect(res.documentId).toBe("doc-1");
    expect(mockUploadDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: "cand-1",
        documentType: RecruitmentDocumentType.resume,
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        content: expect.any(Buffer),
      })
    );
  });

  it("should replace resume via FormData action", async () => {
    const formData = buildUploadFormData({ fileName: "resume-v2.pdf", content: "v2" });
    formData.set("replaceDocumentId", "doc-1");

    const res = await replaceCandidateResumeAction({}, formData);

    expect(res.success).toBeDefined();
    expect(res.documentId).toBe("doc-2");
    expect(mockReplaceResume).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: "cand-1",
        replaceDocumentId: "doc-1",
        fileName: "resume-v2.pdf",
      })
    );
  });

  it("should rename document via action", async () => {
    const res = await renameCandidateDocumentAction(
      {},
      {
        id: "doc-1",
        fileName: "new-resume.pdf",
        candidateId: "cand-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockRenameDocument).toHaveBeenCalled();
  });

  it("should delete document via action", async () => {
    const res = await deleteCandidateDocumentAction(
      {},
      {
        id: "doc-1",
        candidateId: "cand-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockDeleteDocument).toHaveBeenCalled();
  });

  it("should restore document via action", async () => {
    const res = await restoreCandidateDocumentAction(
      {},
      {
        id: "doc-1",
        candidateId: "cand-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockRestoreDocument).toHaveBeenCalled();
  });

  it("should set primary resume via action", async () => {
    const res = await setPrimaryResumeAction(
      {},
      {
        id: "doc-1",
        candidateId: "cand-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockSetPrimaryResume).toHaveBeenCalled();
  });
});
