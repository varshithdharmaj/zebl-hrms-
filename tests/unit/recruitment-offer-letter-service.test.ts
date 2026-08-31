import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferStatus } from "@/generated/prisma/enums";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import type { OfferRepository } from "@/lib/recruitment/repositories/offer-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import type { StorageAdapter } from "@/lib/recruitment/storage";
import type { SendOfferLetterEmailResult } from "@/lib/recruitment/email/send-offer-letter-email";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
  isRecruitmentOffersEnabled: () => true,
  isRecruitmentConversionEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { offer: { count: vi.fn(async () => 0) } },
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
  RecruitmentTimelineService: { append: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/repositories/prisma-application-repository", () => ({
  prismaApplicationRepository: {
    getApplication: vi.fn(async () => ({ id: "app-1", candidateId: "cand-1", jobOpeningId: "job-1" })),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => undefined),
  AUDIT_ACTIONS: {
    RECRUITMENT_OFFER_SENT: "recruitment.offer.sent",
    RECRUITMENT_OFFER_LETTER_GENERATED: "recruitment.offer.letter_generated",
    RECRUITMENT_OFFER_LETTER_SEND_FAILED: "recruitment.offer.letter_send_failed",
  },
}));

vi.mock("@/lib/recruitment/repositories/prisma-communication-repository", () => ({
  prismaCommunicationRepository: {
    createCommunication: vi.fn(async () => ({ id: "comm-1" })),
    updateCommunication: vi.fn(async () => undefined),
    addAttachment: vi.fn(async () => ({ id: "att-1" })),
  },
}));

vi.mock("@/lib/recruitment/pdf/render-offer-letter-pdf", () => ({
  renderOfferLetterPdf: vi.fn(async () => Buffer.from("%PDF-fake")),
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
    status: OfferStatus.draft,
    baseSalary: "18000",
    ctc: 216000,
    currency: "INR",
    department: "Operations",
    location: "Gachibowli",
    joiningDate: new Date(Date.UTC(2026, 5, 19)),
    probationDays: 90,
    noticeBuyout: false,
    salaryBreakdownJson: {
      basicMonthly: 6984,
      hraMonthly: 2880,
      conveyanceMonthly: 540,
      medicalMonthly: 630,
      specialMonthly: 6966,
    },
    offerPdfKey: null,
    application: {
      candidateId: "cand-1",
      jobOpeningId: "job-1",
      candidate: { fullName: "Jane Doe", email: "jane@example.com" },
      jobOpening: { title: "RCM Executive" },
    },
    ...overrides,
  };
}

describe("OfferService — generateOfferLetter", () => {
  let mockRepo: OfferRepository;
  let mockStorage: StorageAdapter;
  let sendEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      save: vi.fn(async () => undefined),
      read: vi.fn(async () => Buffer.from("%PDF-fake")),
      delete: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
      getMetadata: vi.fn(async () => null),
    };
    mockRepo = {
      createOffer: vi.fn(async () => ({ id: "off-1" })),
      updateOffer: vi.fn(async () => undefined),
      getOffer: vi.fn(async () => baseOffer()),
      listOffers: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 })),
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
    sendEmail = vi.fn(
      async (): Promise<SendOfferLetterEmailResult> => ({
        success: true,
        providerMessageId: "msg-1",
      })
    );
  });

  it("generates a PDF, stores it, and stamps letterGeneratedAt/By", async () => {
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    const result = await service.generateOfferLetter(hrSession, { id: "off-1" });

    expect(result.offerPdfKey).toMatch(/^offers\/off-1\/pdf\//);
    expect(mockStorage.save).toHaveBeenCalledWith(
      result.offerPdfKey,
      expect.any(Buffer),
      { contentType: "application/pdf" }
    );
    expect(mockRepo.updateOffer).toHaveBeenCalledWith(
      "off-1",
      expect.objectContaining({
        offerPdfKey: result.offerPdfKey,
        letterGeneratedByUserId: "user-hr",
      }),
      expect.anything()
    );
    expect(RecruitmentTimelineService.append).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "offer_updated" }),
      expect.anything()
    );
  });

  it("rejects generation when the salary breakup is missing (bubbles the validation error)", async () => {
    mockRepo.getOffer = vi.fn(async () => baseOffer({ salaryBreakdownJson: null }));
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    await expect(service.generateOfferLetter(hrSession, { id: "off-1" })).rejects.toThrow(
      RecruitmentDomainError
    );
  });

  it("rejects regenerating the letter for an accepted offer", async () => {
    mockRepo.getOffer = vi.fn(async () => baseOffer({ status: OfferStatus.accepted }));
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    await expect(service.generateOfferLetter(hrSession, { id: "off-1" })).rejects.toThrow(
      RecruitmentDomainError
    );
  });
});

describe("OfferService — sendOffer (email-gated)", () => {
  let mockRepo: OfferRepository;
  let mockStorage: StorageAdapter;
  let sendEmail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      save: vi.fn(async () => undefined),
      read: vi.fn(async () => Buffer.from("%PDF-fake")),
      delete: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
      getMetadata: vi.fn(async () => null),
    };
    mockRepo = {
      createOffer: vi.fn(async () => ({ id: "off-1" })),
      updateOffer: vi.fn(async () => undefined),
      getOffer: vi.fn(async () => baseOffer({ offerPdfKey: "offers/off-1/pdf/abc-letter.pdf" })),
      listOffers: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 })),
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
    sendEmail = vi.fn(
      async (): Promise<SendOfferLetterEmailResult> => ({
        success: true,
        providerMessageId: "msg-1",
      })
    );
  });

  it("rejects sending when no offer letter has been generated", async () => {
    mockRepo.getOffer = vi.fn(async () => baseOffer({ offerPdfKey: null }));
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    await expect(
      service.sendOffer(hrSession, { id: "off-1", expiresAt: null })
    ).rejects.toThrow(RecruitmentDomainError);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockRepo.sendOffer).not.toHaveBeenCalled();
  });

  it("rejects sending when the candidate has no email on file", async () => {
    mockRepo.getOffer = vi.fn(async () =>
      baseOffer({
        offerPdfKey: "offers/off-1/pdf/abc-letter.pdf",
        application: {
          candidateId: "cand-1",
          jobOpeningId: "job-1",
          candidate: { fullName: "Jane Doe", email: null },
          jobOpening: { title: "RCM Executive" },
        },
      })
    );
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    await expect(
      service.sendOffer(hrSession, { id: "off-1", expiresAt: null })
    ).rejects.toThrow(RecruitmentDomainError);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockRepo.sendOffer).not.toHaveBeenCalled();
  });

  it("does NOT mark the offer as sent/released when the email fails", async () => {
    sendEmail.mockResolvedValue({ success: false, error: "SMTP timeout" });
    const service = createOfferService(mockRepo, mockStorage, sendEmail);

    await expect(
      service.sendOffer(hrSession, { id: "off-1", expiresAt: null })
    ).rejects.toThrow(RecruitmentDomainError);

    expect(mockRepo.sendOffer).not.toHaveBeenCalled();
  });

  it("sends the email with the PDF attached and only then releases the offer", async () => {
    const service = createOfferService(mockRepo, mockStorage, sendEmail);
    await service.sendOffer(hrSession, { id: "off-1", expiresAt: null });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "jane@example.com",
        candidateName: "Jane Doe",
        designation: "RCM Executive",
        pdfContent: expect.any(Buffer),
      })
    );
    expect(mockRepo.sendOffer).toHaveBeenCalledWith(
      "off-1",
      null,
      "user-hr",
      expect.anything()
    );
  });
});
