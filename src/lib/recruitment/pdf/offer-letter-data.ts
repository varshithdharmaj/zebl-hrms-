import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import {
  assertSalaryBreakdownMatchesCtc,
  computeSalaryBreakdown,
  parseSalaryComponents,
  type SalaryBreakdownComputation,
} from "@/lib/recruitment/pdf/salary-breakdown";
import { formatIndianRupeesWithWords } from "@/lib/recruitment/pdf/number-to-words";

/** Minimal shape this mapper needs — a subset of OfferDetail + resolved manager name. */
export type OfferLetterSourceData = {
  offer: {
    id: string;
    offerNumber: string | null;
    department: string | null;
    location: string | null;
    ctc: number | null;
    joiningDate: Date | null;
    probationDays: number | null;
    noticeBuyout: boolean;
    salaryBreakdownJson: unknown;
  };
  /** Job title from the application's JobOpening — the offer has no field of its own. */
  designation: string | null;
  candidateName: string;
};

export type OfferLetterTemplateData = {
  offerId: string;
  candidateName: string;
  designation: string;
  branch: string;
  joiningDateFormatted: string;
  joiningDateShort: string;
  ctcAmountWords: string;
  monthlyGrossFormatted: string;
  probationMonthsText: string;
  salary: SalaryBreakdownComputation;
};

function formatDdMmYyyy(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Maps offer/candidate data into the exact fields the offer-letter PDF template
 * consumes. Pure and deterministic — no AI generation, no I/O — so the legal
 * wording in the template stays fixed while only these tokens vary per offer.
 */
export function buildOfferLetterTemplateData(
  source: OfferLetterSourceData
): OfferLetterTemplateData {
  const { offer, candidateName, designation } = source;

  if (!designation?.trim()) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "The application's job title is required before generating the offer letter."
    );
  }
  if (!offer.location?.trim()) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Branch/location is required before generating the offer letter."
    );
  }
  if (!offer.joiningDate) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Joining date is required before generating the offer letter."
    );
  }
  if (offer.ctc == null || offer.ctc <= 0) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "CTC is required before generating the offer letter."
    );
  }

  const components = parseSalaryComponents(offer.salaryBreakdownJson);
  if (!components) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Add the salary breakup (Basic, HRA, Conveyance, Medical, Special Allowances) before generating the offer letter."
    );
  }

  const salary = computeSalaryBreakdown(components);
  assertSalaryBreakdownMatchesCtc(salary, offer.ctc);

  const probationDays = offer.probationDays ?? 90;
  const probationMonths = Math.round(probationDays / 30);

  return {
    offerId: offer.id,
    candidateName: candidateName.trim(),
    designation: designation.trim(),
    branch: offer.location.trim(),
    joiningDateFormatted: formatDdMmYyyy(offer.joiningDate),
    joiningDateShort: formatLongDate(offer.joiningDate),
    ctcAmountWords: formatIndianRupeesWithWords(salary.grossMonthly),
    monthlyGrossFormatted: salary.grossMonthly.toLocaleString("en-IN"),
    probationMonthsText: `${probationMonths} month${probationMonths === 1 ? "" : "s"}`,
    salary,
  };
}
