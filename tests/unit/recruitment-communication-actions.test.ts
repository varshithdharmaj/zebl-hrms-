import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  getSessionOrThrow: vi.fn(async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR",
    sessionVersion: 1,
    authProvider: "local",
  })),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const createDraft = vi.fn(async () => ({ id: "comm-1" }));
const updateDraft = vi.fn(async () => ({ id: "comm-1" }));
const deleteDraft = vi.fn(async () => ({ id: "comm-1" }));
const sendMessage = vi.fn(async () => ({ id: "comm-1" }));
const listCommunications = vi.fn(async () => ({ items: [], total: 0 }));
const searchCommunications = vi.fn(async () => ({ items: [], total: 0 }));
const getThread = vi.fn(async () => []);
const getCommunication = vi.fn(async () => ({
  id: "comm-1",
  candidateId: "cand-1",
}));
const addAttachment = vi.fn(async () => ({ id: "att-1", candidateId: "cand-1" }));
const removeAttachment = vi.fn(async () => ({ id: "att-1", candidateId: "cand-1" }));
const listAttachments = vi.fn(async () => []);
const getAttachment = vi.fn(async () => ({
  attachment: { id: "att-1" },
  communication: { id: "comm-1", candidateId: "cand-1" },
}));
const duplicateDraft = vi.fn(async () => ({ id: "comm-2" }));

vi.mock("@/lib/recruitment/services/communication-service", () => ({
  createCommunicationService: () => ({
    createDraft,
    updateDraft,
    deleteDraft,
    sendMessage,
    listCommunications,
    searchCommunications,
    getThread,
    getCommunication,
    addAttachment,
    removeAttachment,
    listAttachments,
    getAttachment,
    duplicateDraft,
  }),
}));

import {
  createDraftAction,
  updateDraftAction,
  deleteDraftAction,
  sendMessageAction,
  listCommunicationsAction,
  searchCommunicationsAction,
  getThreadAction,
  uploadCommunicationAttachmentAction,
  removeCommunicationAttachmentAction,
  duplicateDraftAction,
} from "@/actions/recruitment-communications";

describe("recruitment-communications actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft", async () => {
    const result = await createDraftAction(
      {},
      {
        subject: "Hello",
        body: "World",
        candidateId: "cand-1",
        recipientEmail: "a@b.com",
      }
    );
    expect(result.success).toBeDefined();
    expect(result.communicationId).toBe("comm-1");
  });

  it("returns validation error for empty draft", async () => {
    const result = await createDraftAction({}, { subject: "", body: "" });
    expect(result.error).toBeDefined();
  });

  it("updates a draft", async () => {
    const result = await updateDraftAction(
      {},
      { id: "comm-1", subject: "Updated", body: "Body" }
    );
    expect(result.success).toBeDefined();
  });

  it("deletes a draft", async () => {
    const result = await deleteDraftAction({}, { id: "comm-1" });
    expect(result.success).toBeDefined();
    expect(deleteDraft).toHaveBeenCalled();
  });

  it("sends a message", async () => {
    const result = await sendMessageAction(
      {},
      {
        subject: "Hi",
        body: "There",
        recipientEmail: "cand@example.com",
      }
    );
    expect(result.success).toBeDefined();
    expect(sendMessage).toHaveBeenCalled();
  });

  it("lists communications", async () => {
    const result = await listCommunicationsAction({ page: 1 });
    expect(result.success).toBe("OK");
    expect(listCommunications).toHaveBeenCalled();
  });

  it("searches communications", async () => {
    const result = await searchCommunicationsAction({ query: "interview" });
    expect(result.success).toBe("OK");
    expect(searchCommunications).toHaveBeenCalled();
  });

  it("gets a thread", async () => {
    const result = await getThreadAction({ threadId: "thread-1" });
    expect(result.success).toBe("OK");
    expect(getThread).toHaveBeenCalled();
  });

  it("uploads an attachment", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "resume.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.set("communicationId", "comm-1");
    formData.set("file", file);

    const result = await uploadCommunicationAttachmentAction({}, formData);
    expect(result.success).toBeDefined();
    expect(result.attachmentId).toBe("att-1");
    expect(addAttachment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        communicationId: "comm-1",
        fileName: "resume.pdf",
        fileType: "application/pdf",
        fileSize: 4,
        content: expect.anything(),
      })
    );
  });

  it("rejects an attachment upload with no file", async () => {
    const formData = new FormData();
    formData.set("communicationId", "comm-1");
    const result = await uploadCommunicationAttachmentAction({}, formData);
    expect(result.error).toBeDefined();
    expect(addAttachment).not.toHaveBeenCalled();
  });

  it("removes an attachment", async () => {
    const result = await removeCommunicationAttachmentAction({}, { id: "att-1" });
    expect(result.success).toBeDefined();
    expect(removeAttachment).toHaveBeenCalled();
  });

  it("duplicates a draft", async () => {
    const result = await duplicateDraftAction({}, { id: "comm-1" });
    expect(result.success).toBeDefined();
    expect(result.communicationId).toBe("comm-2");
    expect(duplicateDraft).toHaveBeenCalled();
  });
});
