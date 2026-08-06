import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferStatus } from "@/generated/prisma/enums";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import type { OfferRepository } from "@/lib/recruitment/repositories/offer-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import type { StorageAdapter } from "@/lib/recruitment/storage";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
  isRecruitmentOffersEnabled: () => true,
  isRecruitmentConversionEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: {
      count: vi.fn(async () => 0),
    },
  },
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

vi.mock("@/lib/recruitment/repositories/prisma-application-repository", () => ({
  prismaApplicationRepository: {
    getApplication: vi.fn(async () => ({
      id: "app-1",
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    })),
  },
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

function baseOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: "off-1",
    applicationId: "app-1",
    offerNumber: "OFFER-2026-1234",
    status: OfferStatus.released,
    baseSalary: "1000000",
    ctc: "1200000",
    currency: "INR",
    offerPdfKey: null,
    application: {
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    },
    ...overrides,
  };
}

describe("OfferService Sprint 2", () => {
  let mockRepo: OfferRepository;
  let mockStorage: StorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      save: vi.fn(async () => undefined),
      read: vi.fn(async () => Buffer.from("%PDF")),
      delete: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
      getMetadata: vi.fn(async () => null),
    };
    mockRepo = {
      createOffer: vi.fn(async () => ({ id: "off-1" })),
      updateOffer: vi.fn(async () => undefined),
      getOffer: vi.fn(async () => baseOffer()),
      listOffers: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
      })),
      listByApplication: vi.fn(async () => []),
      sendOffer: vi.fn(async () => undefined),
      acceptOffer: vi.fn(async () => undefined),
      declineOffer: vi.fn(async () => undefined),
      withdrawOffer: vi.fn(async () => undefined),
      expireOffer: vi.fn(async () => undefined),
      createRevision: vi.fn(async () => ({ id: "rev-1" })),
      latestRevision: vi.fn(async () => ({ version: 1 })),
      existsActiveOffer: vi.fn(async () => false),
    } as unknown as OfferRepository;
  });

  it("creates a revision snapshot and resets offer to draft", async () => {
    const service = createOfferService(mockRepo, mockStorage);
    await service.createRevision(hrSession, {
      id: "off-1",
      changeNote: "Adjusted CTC",
      patch: { ctc: 1300000 },
    });

    expect(mockRepo.createRevision).toHaveBeenCalledWith(
      "off-1",
      expect.objectContaining({ ctc: "1200000" }),
      "Adjusted CTC",
      "user-hr",
      expect.anything()
    );
    expect(mockRepo.updateOffer).toHaveBeenCalledWith(
      "off-1",
      expect.objectContaining({
        ctc: 1300000,
        status: OfferStatus.draft,
      }),
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "offer_updated" }),
      expect.anything()
    );
  });

  it("rejects revision of accepted offers", async () => {
    mockRepo.getOffer = vi.fn(async () => baseOffer({ status: OfferStatus.accepted }));
    const service = createOfferService(mockRepo, mockStorage);
    await expect(
      service.createRevision(hrSession, {
        id: "off-1",
        changeNote: "Nope",
        patch: {},
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("attaches offer PDF to storage and offerPdfKey", async () => {
    const service = createOfferService(mockRepo, mockStorage);
    const result = await service.attachOfferPdf(hrSession, {
      id: "off-1",
      fileName: "offer-letter.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      content: Buffer.from("%PDF"),
    });

    expect(result.offerPdfKey).toMatch(/^offers\/off-1\/pdf\//);
    expect(mockStorage.save).toHaveBeenCalled();
    expect(mockRepo.updateOffer).toHaveBeenCalledWith(
      "off-1",
      expect.objectContaining({ offerPdfKey: result.offerPdfKey }),
      expect.anything()
    );
  });

  it("rejects non-PDF attachments", async () => {
    const service = createOfferService(mockRepo, mockStorage);
    await expect(
      service.attachOfferPdf(hrSession, {
        id: "off-1",
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        content: Buffer.from("hi"),
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });
});
