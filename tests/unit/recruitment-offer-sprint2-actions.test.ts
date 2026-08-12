import { describe, expect, it, vi } from "vitest";
import { OfferStatus } from "@/generated/prisma/enums";
import {
  attachOfferPdfAction,
  createOfferRevisionAction,
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
  }),
  requireRecruitmentAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
  }),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const mockCreateRevision = vi.fn(async () => undefined);
const mockAttachOfferPdf = vi.fn(async () => ({ offerPdfKey: "offers/off-1/pdf/x.pdf" }));

vi.mock("@/lib/recruitment/services/offer-service", () => ({
  createOfferService: () => ({
    createRevision: (...args: unknown[]) => mockCreateRevision(...args),
    attachOfferPdf: (...args: unknown[]) => mockAttachOfferPdf(...args),
  }),
}));

describe("Offer Sprint 2 actions", () => {
  it("creates offer revision via action", async () => {
    const res = await createOfferRevisionAction(
      {},
      {
        id: "off-1",
        changeNote: "CTC bump",
        patch: { ctc: 1500000 },
      }
    );
    expect(res.success).toBeDefined();
    expect(mockCreateRevision).toHaveBeenCalled();
  });

  it("attaches offer PDF via action", async () => {
    const formData = new FormData();
    formData.set("id", "off-1");
    formData.set(
      "file",
      new File([Buffer.from("%PDF")], "offer.pdf", { type: "application/pdf" })
    );

    const res = await attachOfferPdfAction({}, formData);
    expect(res.success).toBeDefined();
    expect(mockAttachOfferPdf).toHaveBeenCalled();
    expect(OfferStatus.released).toBe("released");
  });
});
