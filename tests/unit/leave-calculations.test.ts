import { describe, expect, it, vi } from "vitest";

// Confirmed policy (VEB HR Policy Manual v1.0): EL eligibility = completion
// of one year (12 months) from DOJ.
const { DEFAULT_POLICY_ROW } = vi.hoisted(() => ({
  DEFAULT_POLICY_ROW: {
    id: 1,
    cycleStartDay: 26,
    elAccrualAmount: 0.5,
    elEligibilityMonths: 12,
    elExpiryMonths: 36,
    elEncashmentCapDays: 30,
    slAnnualEntitlement: 6,
    slCarryForward: false,
    slExpiryMonths: null,
    clAnnualEntitlement: 12,
    monthlyLeaveLimit: 2,
    maxConsecutiveDays: 3,
    advanceNoticeDays: 7,
    updatedAt: new Date(),
    updatedBy: null,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leavePolicySettings: {
      findUnique: vi.fn().mockResolvedValue(DEFAULT_POLICY_ROW),
    },
  },
}));

import { getElEligibilityInfo } from "@/lib/leave";

describe("Leave Calculations — EL Eligibility (DOJ + 12 months / one year, policy-driven)", () => {
  it("is eligible once 12 calendar months (one year) have elapsed since DOJ", async () => {
    const joiningDate = new Date(2026, 0, 10); // 10-Jan-2026 -> eligible 10-Jan-2027
    const { eligible, eligibilityDate } = await getElEligibilityInfo(
      joiningDate,
      new Date(2027, 0, 10)
    );
    expect(eligible).toBe(true);
    expect(eligibilityDate).toEqual(new Date(2027, 0, 10));
  });

  it("is not eligible before the one-year mark", async () => {
    const joiningDate = new Date(2026, 0, 10);
    const { eligible } = await getElEligibilityInfo(joiningDate, new Date(2027, 0, 9));
    expect(eligible).toBe(false);
  });

  it("calculates the correct EL eligibility date via calendar-month arithmetic", async () => {
    const joiningDate = new Date(2026, 0, 1); // 1-Jan-2026
    const { eligibilityDate } = await getElEligibilityInfo(joiningDate, joiningDate);
    // 12 calendar months after 1-Jan-2026 = 1-Jan-2027
    expect(eligibilityDate).toEqual(new Date(2027, 0, 1));
  });
});
