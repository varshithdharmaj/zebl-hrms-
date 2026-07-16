import { describe, expect, it } from "vitest";
import { isEligibleForEL, getEligibilityDate } from "@/lib/leave";

describe("Leave Calculations — Eligibility & Date Rules", () => {
  it("determines EL eligibility based on 1-year rule", () => {
    const today = new Date();
    
    // Joined 366 days ago -> Eligible
    const eligibleDate = new Date(today);
    eligibleDate.setFullYear(today.getFullYear() - 1);
    eligibleDate.setDate(eligibleDate.getDate() - 1);
    expect(isEligibleForEL(eligibleDate)).toBe(true);

    // Joined 50 days ago -> Not Eligible
    const ineligibleDate = new Date(today);
    ineligibleDate.setDate(today.getDate() - 50);
    expect(isEligibleForEL(ineligibleDate)).toBe(false);
  });

  it("calculates the correct EL eligibility date", () => {
    const joiningDate = new Date("2026-01-01");
    const targetDate = getEligibilityDate(joiningDate);
    
    // Exactly 1 year after Jan 1, 2026
    expect(targetDate.getFullYear()).toBe(2027);
    expect(targetDate.getMonth()).toBe(0);
    expect(targetDate.getDate()).toBe(1);
  });
});
