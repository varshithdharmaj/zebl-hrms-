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

const policy: ElPolicyDates = {
  cycleStartDay: 26,
  elEligibilityMonths: 14,
  elExpiryMonths: 36,
};

describe("getElEligibilityDate", () => {
  it("DOJ 10-Jan-2026 -> eligibility 10-Mar-2027", () => {
    const d = getElEligibilityDate(new Date(2026, 0, 10), policy);
    expect(d).toEqual(new Date(2027, 2, 10));
  });

  it("DOJ 28-Jan-2026 -> eligibility 28-Mar-2027", () => {
    const d = getElEligibilityDate(new Date(2026, 0, 28), policy);
    expect(d).toEqual(new Date(2027, 2, 28));
  });

  it("DOJ on leap day 29-Feb-2028 normalizes via calendar-month overflow", () => {
    const d = getElEligibilityDate(new Date(2028, 1, 29), policy);
    // 2028-02-29 + 14 months = target month index 1+14=15 -> year+1, month 3 (April), day 29
    expect(d).toEqual(new Date(2029, 3, 29));
  });
});

describe("getFirstElAccrualDate", () => {
  it("eligibility day <= 26 -> same month's 26th", () => {
    const eligibility = new Date(2027, 2, 10); // 10-Mar-2027
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 2, 26));
  });

  it("eligibility day > 26 -> next month's 26th", () => {
    const eligibility = new Date(2027, 2, 28); // 28-Mar-2027
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 3, 26));
  });

  it("eligibility exactly on the 26th -> granted that same day", () => {
    const eligibility = new Date(2027, 2, 26);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 2, 26));
  });

  it("worked example: DOJ 10-Jan-2026 -> first accrual 26-Mar-2027", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 10), policy);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 2, 26));
  });

  it("worked example: DOJ 28-Jan-2026 -> first accrual 26-Apr-2027", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 28), policy);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 3, 26));
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
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 1, 1));
    expect(dates).toEqual([]);
  });

  it("returns [] on the eligibility date itself if before that month's cycle day", () => {
    const joiningDate = new Date(2026, 0, 10); // eligibility 10-Mar-2027, first accrual 26-Mar-2027
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 2, 10));
    expect(dates).toEqual([]);
  });

  it("returns exactly [26-Mar-2027] on the first accrual date", () => {
    const joiningDate = new Date(2026, 0, 10);
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 2, 26));
    expect(dates).toEqual([new Date(2027, 2, 26)]);
  });

  it("returns three consecutive monthly accrual dates", () => {
    const joiningDate = new Date(2026, 0, 10);
    const dates = getElAccrualDatesUpTo(joiningDate, policy, new Date(2027, 4, 26));
    expect(dates).toEqual([
      new Date(2027, 2, 26),
      new Date(2027, 3, 26),
      new Date(2027, 4, 26),
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
