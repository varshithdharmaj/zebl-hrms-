import { describe, expect, it, vi } from "vitest";

const { DEFAULT_POLICY_ROW } = vi.hoisted(() => ({
  DEFAULT_POLICY_ROW: {
    id: 1,
    cycleStartDay: 26,
    elAccrualAmount: 0.5,
    elEligibilityMonths: 14,
    elExpiryMonths: 36,
    slAnnualEntitlement: 6,
    slCarryForward: false,
    slExpiryMonths: null,
    updatedAt: new Date(),
    updatedBy: null,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leavePolicySettings: {
      upsert: vi.fn().mockResolvedValue(DEFAULT_POLICY_ROW),
    },
  },
}));

import { getElEligibilityInfo } from "@/lib/leave";

describe("Leave Calculations — EL Eligibility (DOJ + 14 months, policy-driven)", () => {
  it("is eligible once 14 calendar months have elapsed since DOJ", async () => {
    const joiningDate = new Date(2026, 0, 10); // 10-Jan-2026 -> eligible 10-Mar-2027
    const { eligible, eligibilityDate } = await getElEligibilityInfo(
      joiningDate,
      new Date(2027, 2, 10)
    );
    expect(eligible).toBe(true);
    expect(eligibilityDate).toEqual(new Date(2027, 2, 10));
  });

  it("is not eligible before the 14-month mark", async () => {
    const joiningDate = new Date(2026, 0, 10);
    const { eligible } = await getElEligibilityInfo(joiningDate, new Date(2027, 2, 9));
    expect(eligible).toBe(false);
  });

  it("calculates the correct EL eligibility date via calendar-month arithmetic", async () => {
    const joiningDate = new Date(2026, 0, 1); // 1-Jan-2026
    const { eligibilityDate } = await getElEligibilityInfo(joiningDate, joiningDate);
    // 14 calendar months after 1-Jan-2026 = 1-Mar-2027
    expect(eligibilityDate).toEqual(new Date(2027, 2, 1));
  });
});
