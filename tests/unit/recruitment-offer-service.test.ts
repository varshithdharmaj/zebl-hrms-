import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferStatus } from "@/generated/prisma/enums";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import type { OfferRepository } from "@/lib/recruitment/repositories/offer-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

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
      push: (e: unknown) => events.push(e),
      publishAll: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: any) => Promise<T>) => {
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
  role: "manager",
  employeeId: 2,
  employeeName: "Manager User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("OfferService", () => {
  let mockRepo: OfferRepository;

  beforeEach(() => {
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
    const result = await service.createOffer(hrSession, {
      applicationId: "app-1",
      baseSalary: 1000000,
      ctc: 1200000,
      employmentType: "Full-time",
      department: "Engineering",
      location: "Bangalore",
      grade: "L1",
      joiningDate: "2026-09-01",
    });

    expect(result.id).toBe("off-1");
    expect(mockRepo.createOffer).toHaveBeenCalled();
  });

  it("should fail to create offer if active offer exists", async () => {
    mockRepo.existsActiveOffer = vi.fn(async () => true);
    const service = createOfferService(mockRepo);

    await expect(
      service.createOffer(hrSession, {
        applicationId: "app-1",
        baseSalary: 1000000,
        ctc: 1200000,
        employmentType: "Full-time",
        department: "Engineering",
        location: "Bangalore",
        grade: "L1",
        joiningDate: "2026-09-01",
      })
    ).rejects.toThrow(RecruitmentDomainError);
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
