import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecruitmentCommunicationStatus,
  RecruitmentCommunicationType,
} from "@/generated/prisma/enums";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

const mocks = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "comm-1" })),
  update: vi.fn(async () => ({ id: "comm-1" })),
  findFirst: vi.fn(async () => null),
  findMany: vi.fn(async () => []),
  count: vi.fn(async () => 0),
  attachmentCreate: vi.fn(async () => ({ id: "att-1" })),
  attachmentFindMany: vi.fn(async () => []),
  attachmentDelete: vi.fn(async () => ({ id: "att-1" })),
  templateCreate: vi.fn(async () => ({ id: "tpl-1" })),
  templateUpdate: vi.fn(async () => ({ id: "tpl-1" })),
  templateFindFirst: vi.fn(async () => null),
  templateFindMany: vi.fn(async () => []),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recruitmentCommunication: {
      create: mocks.create,
      update: mocks.update,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
    },
    recruitmentCommunicationAttachment: {
      create: mocks.attachmentCreate,
      findMany: mocks.attachmentFindMany,
      delete: mocks.attachmentDelete,
    },
    recruitmentEmailTemplate: {
      create: mocks.templateCreate,
      update: mocks.templateUpdate,
      findFirst: mocks.templateFindFirst,
      findMany: mocks.templateFindMany,
    },
  },
}));

import { prismaCommunicationRepository } from "@/lib/recruitment/repositories/prisma-communication-repository";

describe("prismaCommunicationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a communication draft", async () => {
    const result = await prismaCommunicationRepository.createCommunication({
      type: RecruitmentCommunicationType.email_sent,
      subject: "Hello",
      body: "Body",
      candidateId: "cand-1",
      senderUserId: "user-1",
    });
    expect(result.id).toBe("comm-1");
    expect(mocks.create).toHaveBeenCalled();
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.status).toBe(RecruitmentCommunicationStatus.draft);
  });

  it("lists with scope and pagination", async () => {
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    const result = await prismaCommunicationRepository.listCommunications({
      scope: unrestrictedRecruitmentScope(),
      filters: { status: RecruitmentCommunicationStatus.draft },
      pagination: { page: 1, pageSize: 10 },
    });
    expect(result.total).toBe(0);
    expect(mocks.findMany).toHaveBeenCalled();
    expect(mocks.count).toHaveBeenCalled();
  });

  it("searches by query", async () => {
    mocks.findMany.mockResolvedValueOnce([]);
    mocks.count.mockResolvedValueOnce(0);
    await prismaCommunicationRepository.searchCommunications({
      scope: unrestrictedRecruitmentScope(),
      query: "interview",
      pagination: { page: 1, pageSize: 25 },
    });
    expect(mocks.findMany).toHaveBeenCalled();
  });

  it("soft deletes a communication", async () => {
    await prismaCommunicationRepository.softDeleteCommunication("comm-1");
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("adds an attachment", async () => {
    const result = await prismaCommunicationRepository.addAttachment("comm-1", {
      fileName: "resume.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      storagePath: "uploads/resume.pdf",
    });
    expect(result.id).toBe("att-1");
    expect(mocks.attachmentCreate).toHaveBeenCalled();
  });

  it("counts drafts by user", async () => {
    mocks.count.mockResolvedValueOnce(3);
    const total = await prismaCommunicationRepository.countDraftsByUser(
      "user-1",
      unrestrictedRecruitmentScope()
    );
    expect(total).toBe(3);
  });
});
