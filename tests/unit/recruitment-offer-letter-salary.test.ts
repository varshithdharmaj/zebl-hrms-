import { describe, expect, it } from "vitest";
import {
  computeSalaryBreakdown,
  assertSalaryBreakdownMatchesCtc,
  parseSalaryComponents,
} from "@/lib/recruitment/pdf/salary-breakdown";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

describe("computeSalaryBreakdown", () => {
  it("matches the ZEBL sample annexure (RCM Executive, CTC 216000)", () => {
    const result = computeSalaryBreakdown({
      basicMonthly: 6984,
      hraMonthly: 2880,
      conveyanceMonthly: 540,
      medicalMonthly: 630,
      specialMonthly: 6966,
    });

    expect(result.grossMonthly).toBe(18000);
    expect(result.grossAnnual).toBe(216000);
    expect(result.rows).toEqual([
      { label: "Basic", monthly: 6984, annual: 83808 },
      { label: "HRA", monthly: 2880, annual: 34560 },
      { label: "Conveyance", monthly: 540, annual: 6480 },
      { label: "Medical Allowances", monthly: 630, annual: 7560 },
      { label: "Special Allowances", monthly: 6966, annual: 83592 },
    ]);
  });

  it("rounds fractional monthly inputs deterministically before deriving annual", () => {
    const result = computeSalaryBreakdown({
      basicMonthly: 1000.4,
      hraMonthly: 500.6,
      conveyanceMonthly: 0,
      medicalMonthly: 0,
      specialMonthly: 0,
    });

    expect(result.rows[0].monthly).toBe(1000);
    expect(result.rows[1].monthly).toBe(501);
    expect(result.grossAnnual).toBe((1000 + 501) * 12);
  });

  it("handles an all-zero breakdown without dividing by zero or NaN", () => {
    const result = computeSalaryBreakdown({
      basicMonthly: 0,
      hraMonthly: 0,
      conveyanceMonthly: 0,
      medicalMonthly: 0,
      specialMonthly: 0,
    });
    expect(result.grossMonthly).toBe(0);
    expect(result.grossAnnual).toBe(0);
  });
});

describe("assertSalaryBreakdownMatchesCtc", () => {
  it("passes silently when the annexure foots to the CTC", () => {
    const computation = computeSalaryBreakdown({
      basicMonthly: 6984,
      hraMonthly: 2880,
      conveyanceMonthly: 540,
      medicalMonthly: 630,
      specialMonthly: 6966,
    });
    expect(() => assertSalaryBreakdownMatchesCtc(computation, 216000)).not.toThrow();
  });

  it("throws a RecruitmentDomainError when the annexure doesn't match the CTC", () => {
    const computation = computeSalaryBreakdown({
      basicMonthly: 6984,
      hraMonthly: 2880,
      conveyanceMonthly: 540,
      medicalMonthly: 630,
      specialMonthly: 6966,
    });
    expect(() => assertSalaryBreakdownMatchesCtc(computation, 300000)).toThrow(
      RecruitmentDomainError
    );
  });
});

describe("parseSalaryComponents", () => {
  it("parses a valid components object", () => {
    const parsed = parseSalaryComponents({
      basicMonthly: 1000,
      hraMonthly: 200,
      conveyanceMonthly: 50,
      medicalMonthly: 50,
      specialMonthly: 100,
    });
    expect(parsed).toEqual({
      basicMonthly: 1000,
      hraMonthly: 200,
      conveyanceMonthly: 50,
      medicalMonthly: 50,
      specialMonthly: 100,
    });
  });

  it("returns null for missing fields (legacy offers without a breakup)", () => {
    expect(parseSalaryComponents({ basicMonthly: 1000 })).toBeNull();
    expect(parseSalaryComponents(null)).toBeNull();
    expect(parseSalaryComponents(undefined)).toBeNull();
    expect(parseSalaryComponents({})).toBeNull();
  });

  it("returns null when a component is negative or non-numeric", () => {
    expect(
      parseSalaryComponents({
        basicMonthly: -1,
        hraMonthly: 200,
        conveyanceMonthly: 50,
        medicalMonthly: 50,
        specialMonthly: 100,
      })
    ).toBeNull();
    expect(
      parseSalaryComponents({
        basicMonthly: "not-a-number",
        hraMonthly: 200,
        conveyanceMonthly: 50,
        medicalMonthly: 50,
        specialMonthly: 100,
      })
    ).toBeNull();
  });
});
