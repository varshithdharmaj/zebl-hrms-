import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOfferAction,
  updateOfferAction,
  sendOfferAction,
  acceptOfferAction,
  declineOfferAction,
  withdrawOfferAction,
  expireOfferAction,
  duplicateOfferAction,
} from "@/actions/recruitment-offers";

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
  getSessionOrThrow: async () => ({
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
  isRecruitmentOffersEnabled: () => true,
  isRecruitmentConversionEnabled: () => true,
}));

const mockCreateOffer = vi.fn(async () => ({ id: "off-1" }));
const mockUpdateDraft = vi.fn(async () => undefined);
const mockSendOffer = vi.fn(async () => undefined);
const mockAcceptOffer = vi.fn(async () => undefined);
const mockDeclineOffer = vi.fn(async () => undefined);
const mockWithdrawOffer = vi.fn(async () => undefined);
const mockExpireOffer = vi.fn(async () => undefined);
const mockDuplicateOffer = vi.fn(async () => ({ id: "off-2" }));

vi.mock("@/lib/recruitment/services/offer-service", () => ({
  createOfferService: () => ({
    createOffer: (...args: any[]) => (mockCreateOffer as any)(...args),
    updateDraft: (...args: any[]) => (mockUpdateDraft as any)(...args),
    sendOffer: (...args: any[]) => (mockSendOffer as any)(...args),
    acceptOffer: (...args: any[]) => (mockAcceptOffer as any)(...args),
    declineOffer: (...args: any[]) => (mockDeclineOffer as any)(...args),
    withdrawOffer: (...args: any[]) => (mockWithdrawOffer as any)(...args),
    expireOffer: (...args: any[]) => (mockExpireOffer as any)(...args),
    duplicateOffer: (...args: any[]) => (mockDuplicateOffer as any)(...args),
  }),
}));

describe("Offer Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create offer draft via action", async () => {
    const res = await createOfferAction(
      {},
      {
        applicationId: "app-1",
        baseSalary: 1000000,
        ctc: 1200000,
        employmentType: "Full-time",
        department: "Engineering",
        location: "Bangalore",
        grade: "L1",
        joiningDate: "2026-09-01",
      }
    );

    expect(res.success).toBeDefined();
    expect(res.offerId).toBe("off-1");
    expect(mockCreateOffer).toHaveBeenCalled();
  });

  it("should update offer draft via action", async () => {
    const res = await updateOfferAction(
      {},
      {
        id: "off-1",
        applicationId: "app-1",
        baseSalary: 1100000,
        ctc: 1300000,
        employmentType: "Full-time",
        department: "Engineering",
        location: "Bangalore",
        grade: "L1",
        joiningDate: "2026-09-01",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockUpdateDraft).toHaveBeenCalled();
  });

  it("should send offer via action", async () => {
    const res = await sendOfferAction(
      {},
      {
        id: "off-1",
        expiresAt: "2026-08-15",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockSendOffer).toHaveBeenCalled();
  });

  it("should accept offer via action", async () => {
    const res = await acceptOfferAction(
      {},
      {
        id: "off-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockAcceptOffer).toHaveBeenCalled();
  });

  it("should decline offer via action", async () => {
    const res = await declineOfferAction(
      {},
      {
        id: "off-1",
        reason: "Compensation too low",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockDeclineOffer).toHaveBeenCalled();
  });

  it("should withdraw offer via action", async () => {
    const res = await withdrawOfferAction(
      {},
      {
        id: "off-1",
        reason: "Headcount frozen",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockWithdrawOffer).toHaveBeenCalled();
  });

  it("should expire offer via action", async () => {
    const res = await expireOfferAction(
      {},
      {
        id: "off-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockExpireOffer).toHaveBeenCalled();
  });

  it("should duplicate offer via action", async () => {
    const res = await duplicateOfferAction(
      {},
      {
        id: "off-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(res.offerId).toBe("off-2");
    expect(mockDuplicateOffer).toHaveBeenCalled();
  });
});
