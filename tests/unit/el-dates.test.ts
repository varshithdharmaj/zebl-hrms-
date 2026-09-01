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

  it("DOJ on leap day 29-Feb-2024 clamps into a non-leap target year (2025 Feb has 28 days)", () => {
    const d = getElEligibilityDate(new Date(2024, 1, 29), policy);
    expect(d).toEqual(new Date(2025, 1, 28));
  });
});

describe("addCalendarMonths month-end clamping (via getElEligibilityDate, +12 months)", () => {
  // Confirmed rule: clamp to the last valid day of the target month rather
  // than letting JS Date overflow into the next month (e.g. 31 Dec + 12mo
  // must land on 31 Dec next year, never early January).
  const cases: [string, Date, Date][] = [
    ["28-Jan", new Date(2026, 0, 28), new Date(2027, 0, 28)],
    ["29-Jan", new Date(2026, 0, 29), new Date(2027, 0, 29)],
    ["30-Jan", new Date(2026, 0, 30), new Date(2027, 0, 30)],
    ["31-Jan", new Date(2026, 0, 31), new Date(2027, 0, 31)],
    ["28-Feb", new Date(2026, 1, 28), new Date(2027, 1, 28)],
    ["29-Feb (leap source)", new Date(2024, 1, 29), new Date(2025, 1, 28)],
    ["30-Mar", new Date(2026, 2, 30), new Date(2027, 2, 30)],
    ["31-Mar", new Date(2026, 2, 31), new Date(2027, 2, 31)],
    ["30-Apr", new Date(2026, 3, 30), new Date(2027, 3, 30)],
    ["31-May", new Date(2026, 4, 31), new Date(2027, 4, 31)],
    ["30-Nov", new Date(2026, 10, 30), new Date(2027, 10, 30)],
    ["31-Dec", new Date(2026, 11, 31), new Date(2027, 11, 31)],
  ];

  it.each(cases)("%s + 12 months", (_label, doj, expected) => {
    expect(getElEligibilityDate(doj, policy)).toEqual(expected);
  });

  it("31-Dec-2025 + 12 months = 31-Dec-2026 (does not overflow into January)", () => {
    expect(getElEligibilityDate(new Date(2025, 11, 31), policy)).toEqual(new Date(2026, 11, 31));
  });
});

describe("first applicable 26th after month-end-clamped eligibility", () => {
  it("31-Jan DOJ -> eligibility 31-Jan next year -> first accrual 26th of the following month", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 31), policy);
    expect(eligibility).toEqual(new Date(2027, 0, 31));
    // day 31 > cycleStartDay 26 -> next month's 26th
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
  });

  it("30-Nov DOJ -> eligibility 30-Nov next year -> first accrual next month's 26th", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 10, 30), policy);
    expect(eligibility).toEqual(new Date(2027, 10, 30));
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 11, 26));
  });

  it("29-Feb (leap) DOJ -> eligibility clamped to 28-Feb next year -> first accrual same month's 26th", () => {
    const eligibility = getElEligibilityDate(new Date(2024, 1, 29), policy);
    expect(eligibility).toEqual(new Date(2025, 1, 28));
    // day 28 > cycleStartDay 26 -> next month's 26th
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2025, 2, 26));
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

  it("DOJ one day before the 26th (25th) -> eligibility 25th next year -> first accrual same month's 26th", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 25), policy);
    expect(eligibility).toEqual(new Date(2027, 0, 25));
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 0, 26));
  });

  it("DOJ one day after the 26th (27th) -> eligibility 27th next year -> first accrual next month's 26th", () => {
    const eligibility = getElEligibilityDate(new Date(2026, 0, 27), policy);
    expect(eligibility).toEqual(new Date(2027, 0, 27));
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
  });

  it("eligibility on the 27th (one day after cycle day) -> next month's 26th", () => {
    const eligibility = new Date(2027, 0, 27);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
  });

  it("eligibility on a month-end date (31st) -> next month's 26th", () => {
    const eligibility = new Date(2027, 0, 31);
    expect(getFirstElAccrualDate(eligibility, policy)).toEqual(new Date(2027, 1, 26));
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
