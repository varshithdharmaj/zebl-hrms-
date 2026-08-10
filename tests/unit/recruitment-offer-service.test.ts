import { beforeEach, describe, expect, it, vi } from "vitest";
import { HiringDecisionOutcome, OfferStatus } from "@/generated/prisma/enums";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import type { OfferRepository } from "@/lib/recruitment/repositories/offer-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

const findUniqueSettings = vi.fn(async () => ({ requireDecisionForOffer: true }));
const findCurrentDecision = vi.fn(async () => ({
  id: "dec-hire",
  applicationId: "app-1",
  outcome: HiringDecisionOutcome.hire,
}));

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
    recruitmentSettings: {
      findUnique: (...args: unknown[]) => findUniqueSettings(...args),
    },
  },
}));

vi.mock("@/lib/recruitment/repositories/prisma-decision-repository", () => ({
  prismaDecisionRepository: {
    findCurrent: (...args: unknown[]) => findCurrentDecision(...args),
  },
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => {
    const events: unknown[] = [];
    return {
      enqueue: (event: unknown) => events.push(event),
      flush: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => {
    return work({});
  },
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

const managerSession: SessionUser = {
  id: "user-manager",
  email: "manager@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Manager User",
  sessionVersion: 1,
  authProvider: "local",
};

const offerInput = {
  applicationId: "app-1",
  baseSalary: 1000000,
  ctc: 1200000,
  employmentType: "Full-time",
  department: "Engineering",
  location: "Bangalore",
  grade: "L1",
  joiningDate: "2026-09-01",
};

describe("OfferService", () => {
  let mockRepo: OfferRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueSettings.mockResolvedValue({ requireDecisionForOffer: true });
    findCurrentDecision.mockResolvedValue({
      id: "dec-hire",
      applicationId: "app-1",
      outcome: HiringDecisionOutcome.hire,
    });
    mockRepo = {
      createOffer: vi.fn(async () => ({ id: "off-1" })),
      updateOffer: vi.fn(async () => undefined),
      getOffer: vi.fn(async () => ({
        id: "off-1",
        applicationId: "app-1",
        offerNumber: "OFFER-2026-1234",
        status: OfferStatus.draft,
        baseSalary: "1000000",
        ctc: "1200000",
        currency: "INR",
        application: {
          candidateId: "cand-1",
          jobOpeningId: "job-1",
        },
      })),
      listOffers: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 })),
      listByApplication: vi.fn(async () => []),
      sendOffer: vi.fn(async () => undefined),
      acceptOffer: vi.fn(async () => undefined),
      declineOffer: vi.fn(async () => undefined),
      withdrawOffer: vi.fn(async () => undefined),
      expireOffer: vi.fn(async () => undefined),
      createRevision: vi.fn(async () => ({ id: "rev-1" })),
      latestRevision: vi.fn(async () => null),
      existsActiveOffer: vi.fn(async () => false),
    } as unknown as OfferRepository;
  });

  it("should create offer successfully", async () => {
    const service = createOfferService(mockRepo);
    const result = await service.createOffer(hrSession, offerInput);

    expect(result.id).toBe("off-1");
    expect(mockRepo.createOffer).toHaveBeenCalled();
  });

  it("should fail to create offer if active offer exists", async () => {
    mockRepo.existsActiveOffer = vi.fn(async () => true);
    const service = createOfferService(mockRepo);

    await expect(service.createOffer(hrSession, offerInput)).rejects.toThrow(RecruitmentDomainError);
  });

  it("fails when requireDecisionForOffer=true and no decision exists", async () => {
    findCurrentDecision.mockResolvedValue(null);
    const service = createOfferService(mockRepo);

    await expect(service.createOffer(hrSession, offerInput)).rejects.toMatchObject({
      message: "Submit a hiring decision before creating an offer.",
    });
    expect(mockRepo.createOffer).not.toHaveBeenCalled();
  });

  it("fails when current decision is reject", async () => {
    findCurrentDecision.mockResolvedValue({
      id: "dec-1",
      outcome: HiringDecisionOutcome.reject,
    });
    const service = createOfferService(mockRepo);
    await expect(service.createOffer(hrSession, offerInput)).rejects.toMatchObject({
      message: "Offers are only allowed after a strong_hire or hire decision.",
    });
  });

  it("fails when current decision is hold", async () => {
    findCurrentDecision.mockResolvedValue({
      id: "dec-1",
      outcome: HiringDecisionOutcome.hold,
    });
    const service = createOfferService(mockRepo);
    await expect(service.createOffer(hrSession, offerInput)).rejects.toThrow(RecruitmentDomainError);
  });

  it("fails when current decision is borderline", async () => {
    findCurrentDecision.mockResolvedValue({
      id: "dec-1",
      outcome: HiringDecisionOutcome.borderline,
    });
    const service = createOfferService(mockRepo);
    await expect(service.createOffer(hrSession, offerInput)).rejects.toThrow(RecruitmentDomainError);
  });

  it("succeeds for current hire and stamps hiringDecisionId", async () => {
    const service = createOfferService(mockRepo);
    await service.createOffer(hrSession, {
      ...offerInput,
      hiringDecisionId: "client-forged-id",
    });

    expect(mockRepo.createOffer).toHaveBeenCalledWith(
      expect.objectContaining({ hiringDecisionId: "dec-hire" }),
      expect.anything()
    );
  });

  it("succeeds for current strong_hire", async () => {
    findCurrentDecision.mockResolvedValue({
      id: "dec-strong",
      outcome: HiringDecisionOutcome.strong_hire,
    });
    const service = createOfferService(mockRepo);
    await service.createOffer(hrSession, offerInput);
    expect(mockRepo.createOffer).toHaveBeenCalledWith(
      expect.objectContaining({ hiringDecisionId: "dec-strong" }),
      expect.anything()
    );
  });

  it("allows create without a decision when requireDecisionForOffer=false", async () => {
    findUniqueSettings.mockResolvedValue({ requireDecisionForOffer: false });
    findCurrentDecision.mockResolvedValue(null);
    const service = createOfferService(mockRepo);
    await service.createOffer(hrSession, offerInput);
    expect(findCurrentDecision).not.toHaveBeenCalled();
    expect(mockRepo.createOffer).toHaveBeenCalledWith(
      expect.objectContaining({ hiringDecisionId: null }),
      expect.anything()
    );
  });

  it("keeps hiringDecisionId null when setting is false", async () => {
    findUniqueSettings.mockResolvedValue({ requireDecisionForOffer: false });
    const service = createOfferService(mockRepo);
    await service.createOffer(hrSession, offerInput);
    const created = vi.mocked(mockRepo.createOffer).mock.calls[0]?.[0] as {
      hiringDecisionId?: string | null;
    };
    expect(created.hiringDecisionId).toBeNull();
  });

  it("should send offer successfully", async () => {
    const service = createOfferService(mockRepo);
    await service.sendOffer(hrSession, { id: "off-1", expiresAt: "2026-08-15" });

    expect(mockRepo.sendOffer).toHaveBeenCalled();
  });

  it("should allow HR to withdraw offer", async () => {
    mockRepo.getOffer = vi.fn(async () => ({
      id: "off-1",
      applicationId: "app-1",
      offerNumber: "OFFER-2026-1234",
      status: OfferStatus.released,
      application: {
        candidateId: "cand-1",
        jobOpeningId: "job-1",
      },
    }));

    const service = createOfferService(mockRepo);
    await service.withdrawOffer(hrSession, { id: "off-1", reason: "Budget cut" });

    expect(mockRepo.withdrawOffer).toHaveBeenCalled();
  });

  it("should prevent Manager from withdrawing offer", async () => {
    const service = createOfferService(mockRepo);

    await expect(
      service.withdrawOffer(managerSession, { id: "off-1", reason: "Budget cut" })
    ).rejects.toThrow(RecruitmentDomainError);
  });
});
