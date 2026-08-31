import { describe, expect, it } from "vitest";
import { buildOfferLetterFileName } from "@/lib/recruitment/pdf/filename";
import { amountToIndianWords, formatIndianRupeesWithWords } from "@/lib/recruitment/pdf/number-to-words";

describe("buildOfferLetterFileName", () => {
  it("builds the expected filename for a normal name", () => {
    expect(buildOfferLetterFileName("Jane Doe")).toBe("ZEBL_Offer_Letter_Jane_Doe.pdf");
  });

  it("strips special characters and path-like segments", () => {
    expect(buildOfferLetterFileName("../../etc/passwd")).toBe(
      "ZEBL_Offer_Letter_etcpasswd.pdf"
    );
    expect(buildOfferLetterFileName("O'Brien-Smith, Jr.")).toBe(
      "ZEBL_Offer_Letter_OBrienSmith_Jr.pdf"
    );
  });

  it("collapses repeated whitespace", () => {
    expect(buildOfferLetterFileName("Jane   Doe")).toBe("ZEBL_Offer_Letter_Jane_Doe.pdf");
  });

  it("falls back to 'Candidate' when the name has no usable characters", () => {
    expect(buildOfferLetterFileName("!!!")).toBe("ZEBL_Offer_Letter_Candidate.pdf");
    expect(buildOfferLetterFileName("")).toBe("ZEBL_Offer_Letter_Candidate.pdf");
  });

  it("truncates very long candidate names", () => {
    const longName = "A".repeat(200);
    const fileName = buildOfferLetterFileName(longName);
    expect(fileName.length).toBeLessThanOrEqual("ZEBL_Offer_Letter_.pdf".length + 80);
  });

  it("handles unicode names by stripping diacritics-only remnants gracefully", () => {
    const fileName = buildOfferLetterFileName("José García");
    expect(fileName.startsWith("ZEBL_Offer_Letter_")).toBe(true);
    expect(fileName.endsWith(".pdf")).toBe(true);
  });
});

describe("amountToIndianWords / formatIndianRupeesWithWords", () => {
  it("matches the ZEBL sample: 216000 -> Two Lakhs Sixteen Thousand", () => {
    expect(amountToIndianWords(216000)).toBe("Two Lakhs Sixteen Thousand");
    expect(formatIndianRupeesWithWords(216000)).toBe(
      "Rs. 2,16,000 (Two Lakhs Sixteen Thousand Only)"
    );
  });

  it("handles zero", () => {
    expect(amountToIndianWords(0)).toBe("Zero");
  });

  it("handles crore-scale amounts", () => {
    expect(amountToIndianWords(12345678)).toBe(
      "One Crore Twenty Three Lakhs Forty Five Thousand Six Hundred Seventy Eight"
    );
  });

  it("rounds fractional rupees before converting", () => {
    expect(amountToIndianWords(999.6)).toBe("One Thousand");
  });
});
