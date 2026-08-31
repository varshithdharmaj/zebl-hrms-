import { describe, expect, it } from "vitest";
import { buildOfferLetterTemplateData } from "@/lib/recruitment/pdf/offer-letter-data";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

function baseSource(overrides: Record<string, unknown> = {}) {
  return {
    offer: {
      id: "off-1",
      offerNumber: "OFFER-2026-1234",
      department: "Operations",
      location: "Gachibowli",
      ctc: 216000,
      joiningDate: new Date(Date.UTC(2026, 5, 19)),
      probationDays: 90,
      noticeBuyout: false,
      salaryBreakdownJson: {
        basicMonthly: 6984,
        hraMonthly: 2880,
        conveyanceMonthly: 540,
        medicalMonthly: 630,
        specialMonthly: 6966,
      },
      ...overrides,
    },
    designation: "RCM Executive",
    candidateName: "Jane Doe",
  };
}

describe("buildOfferLetterTemplateData", () => {
  it("maps a complete offer into template data matching the ZEBL sample", () => {
    const data = buildOfferLetterTemplateData(baseSource());

    expect(data.candidateName).toBe("Jane Doe");
    expect(data.designation).toBe("RCM Executive");
    expect(data.branch).toBe("Gachibowli");
    expect(data.joiningDateFormatted).toBe("19.06.2026");
    expect(data.monthlyGrossFormatted).toBe("18,000");
    expect(data.ctcAmountWords).toContain("Eighteen Thousand");
    expect(data.probationMonthsText).toBe("3 months");
    expect(data.salary.grossAnnual).toBe(216000);
  });

  it("throws when the application's job title (designation) is missing", () => {
    const source = baseSource();
    source.designation = "";
    expect(() => buildOfferLetterTemplateData(source)).toThrow(RecruitmentDomainError);
  });

  it("throws when location is missing", () => {
    expect(() =>
      buildOfferLetterTemplateData(baseSource({ location: null }))
    ).toThrow(RecruitmentDomainError);
  });

  it("throws when joining date is missing", () => {
    expect(() =>
      buildOfferLetterTemplateData(baseSource({ joiningDate: null }))
    ).toThrow(RecruitmentDomainError);
  });

  it("throws when CTC is missing or non-positive", () => {
    expect(() => buildOfferLetterTemplateData(baseSource({ ctc: null }))).toThrow(
      RecruitmentDomainError
    );
    expect(() => buildOfferLetterTemplateData(baseSource({ ctc: 0 }))).toThrow(
      RecruitmentDomainError
    );
  });

  it("throws when the salary breakup is missing", () => {
    expect(() =>
      buildOfferLetterTemplateData(baseSource({ salaryBreakdownJson: null }))
    ).toThrow(RecruitmentDomainError);
  });

  it("throws when the salary breakup doesn't foot to the CTC", () => {
    expect(() =>
      buildOfferLetterTemplateData(baseSource({ ctc: 999999 }))
    ).toThrow(RecruitmentDomainError);
  });

  it("defaults probation to 90 days (3 months) when not set", () => {
    const data = buildOfferLetterTemplateData(baseSource({ probationDays: null }));
    expect(data.probationMonthsText).toBe("3 months");
  });

  it("handles a 1-month probation with correct singular wording", () => {
    const data = buildOfferLetterTemplateData(baseSource({ probationDays: 30 }));
    expect(data.probationMonthsText).toBe("1 month");
  });
});
