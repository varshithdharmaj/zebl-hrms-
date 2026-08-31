import { describe, expect, it } from "vitest";
import {
  getCycleKey,
  getElAccrualDatesUpTo,
  getElEligibilityDate,
  getElExpiryDate,
  getFirstElAccrualDate,
  getLeaveCycleWindow,
  type ElPolicyDates,
} from "@/lib/leave/el-dates";

// Confirmed policy (VEB HR Policy Manual v1.0): EL eligibility = completion
// of one year (12 months) from DOJ — NOT the earlier 14-month interim rule.
const policy: ElPolicyDates = {
  cycleStartDay: 26,
  elEligibilityMonths: 12,
  elExpiryMonths: 36,
};

describe("getElEligibilityDate", () => {
  it("DOJ 10-Jan-2026 -> eligibility 10-Jan-2027 (one year)", () => {
    const d = getElEligibilityDate(new Date(2026, 0, 10), policy);
    expect(d).toEqual(new Date(2027, 0, 10));
  });

  it("DOJ 28-Jan-2026 -> eligibility 28-Jan-2027 (one year)", () => {
    const d = getElEligibilityDate(new Date(2026, 0, 28), policy);
    expect(d).toEqual(new Date(2027, 0, 28));
  });

  it("DOJ on leap day 29-Feb-2028 normalizes via calendar-month overflow into a non-leap target year", () => {
    const d = getElEligibilityDate(new Date(2028, 1, 29), policy);
    // 2028 is a leap year but 2029 is not (Feb 2029 has 28 days), so the
    // naive +12-month Date arithmetic overflows Feb 29 into 1-Mar-2029.
    // This is real calendar-month arithmetic (not a fixed-365-day
    // approximation) — the overflow itself is a known, documented edge case.
    expect(d).toEqual(new Date(2029, 2, 1));
  });
});

describe("getFirstElAccrualDate", () => {
  it("eligibility day <= 26 -> same month's 26th", () => {
    const eligibility = new Date(2027, 0, 10); // 10-Jan-2027
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 0, 26));
  });

  it("eligibility day > 26 -> next month's 26th", () => {
    const eligibility = new Date(2027, 0, 28); // 28-Jan-2027
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
  });

  it("eligibility exactly on the 26th -> granted that same day", () => {
    const eligibility = new Date(2027, 0, 26);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 0, 26));
  });

  it("worked example: DOJ 10-Jan-2026 -> eligibility 10-Jan-2027 -> first accrual 26-Jan-2027", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 10), policy);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 0, 26));
  });

  it("worked example: DOJ 28-Jan-2026 -> eligibility 28-Jan-2027 -> first accrual 26-Feb-2027", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 28), policy);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
  });

  it("worked example: DOJ 26-Jan-2026 -> eligibility exactly 26-Jan-2027 -> first accrual same day", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 26), policy);
    expect(eligibility).toEqual(new Date(2027, 0, 26));
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 0, 26));
  });

  it("is generic to any configured eligibility period, e.g. 6 months", () => {
    const shortPolicy: ElPolicyDates = { ...policy, elEligibilityMonths: 6 };
    const eligibility = getElEligibilityDate(new Date(2026, 0, 10), shortPolicy);
    expect(eligibility).toEqual(new Date(2026, 6, 10));
    expect(getFirstElAccrualDate(eligibility, shortPolicy)).toEqual(new Date(2026, 6, 26));
  });
});

describe("getElExpiryDate", () => {
  it("26-Mar-2027 -> expires 26-Mar-2030", () => {
    expect(getElExpiryDate(new Date(2027, 2, 26), policy)).toEqual(new Date(2030, 2, 26));
  });

  it("26-Apr-2027 -> expires 26-Apr-2030", () => {
    expect(getElExpiryDate(new Date(2027, 3, 26), policy)).toEqual(new Date(2030, 3, 26));
  });
});

describe("getCycleKey", () => {
  it("formats as YYYY-MM", () => {
    expect(getCycleKey(new Date(2027, 2, 26))).toBe("2027-03");
  });
});

describe("getElAccrualDatesUpTo", () => {
  it("returns [] before eligibility", () => {
    const joiningDate = new Date(2026, 0, 10);
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2026, 11, 1));
    expect(dates).toEqual([]);
  });

  it("returns [] on the eligibility date itself if before that month's cycle day", () => {
    const joiningDate = new Date(2026, 0, 10); // eligibility 10-Jan-2027, first accrual 26-Jan-2027
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 0, 10));
    expect(dates).toEqual([]);
  });

  it("returns exactly [26-Jan-2027] on the first accrual date", () => {
    const joiningDate = new Date(2026, 0, 10);
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 0, 26));
    expect(dates).toEqual([new Date(2027, 0, 26)]);
  });

  it("returns three consecutive monthly accrual dates", () => {
    const joiningDate = new Date(2026, 0, 10);
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 2, 26));
    expect(dates).toEqual([
      new Date(2027, 0, 26),
      new Date(2027, 1, 26),
      new Date(2027, 2, 26),
    ]);
  });
});

describe("getLeaveCycleWindow", () => {
  it("on/after the 26th -> this month's 26th through next month's 25th", () => {
    const { startDate, endDate } = getLeaveCycleWindow(policy, new Date(2026, 0, 26));
    expect(startDate).toEqual(new Date(2026, 0, 26));
    expect(endDate).toEqual(new Date(2026, 1, 25));
  });

  it("before the 26th -> previous month's 26th through this month's 25th", () => {
    const { startDate, endDate } = getLeaveCycleWindow(policy, new Date(2026, 0, 10));
    expect(startDate).toEqual(new Date(2025, 11, 26));
    expect(endDate).toEqual(new Date(2026, 0, 25));
  });

  it("handles December -> January year rollover", () => {
    const { startDate, endDate } = getLeaveCycleWindow(policy, new Date(2025, 11, 26));
    expect(startDate).toEqual(new Date(2025, 11, 26));
    expect(endDate).toEqual(new Date(2026, 0, 25));
  });
});
