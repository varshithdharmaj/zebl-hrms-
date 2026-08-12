import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import type { OfferRepository } from "@/lib/recruitment/repositories/offer-repository";
import type { SessionUser } from "@/lib/session";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: { count: vi.fn(async () => 0) },
  },
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recruitment/permissions/recruitment-scope-engine")
  >("@/lib/recruitment/permissions/recruitment-scope-engine");
  return {
    ...actual,
    RecruitmentScopeEngine: {
      ...actual.RecruitmentScopeEngine,
      getScope: vi.fn(async () => unrestrictedRecruitmentScope()),
    },
  };
});

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("OfferService listOffers candidateId filter", () => {
  let listOffers: ReturnType<typeof vi.fn>;
  let mockRepo: OfferRepository;

  beforeEach(() => {
    listOffers = vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 50 }));
    mockRepo = {
      listOffers,
    } as unknown as OfferRepository;
  });

  it("passes candidateId filter through to scoped repository list", async () => {
    const service = createOfferService(mockRepo);
    await service.listOffers(hrSession, {
      filters: { candidateId: "cand-1" },
      pagination: { page: 1, pageSize: 50 },
    });

    expect(listOffers).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { candidateId: "cand-1" },
        scope: unrestrictedRecruitmentScope(),
      })
    );
  });
});
