import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

/** Monthly salary components as entered by HR on the offer (matches the ZEBL annexure). */
export type SalaryComponentsMonthly = {
  basicMonthly: number;
  hraMonthly: number;
  conveyanceMonthly: number;
  medicalMonthly: number;
  specialMonthly: number;
};

export type SalaryComponentAmount = {
  label: string;
  monthly: number;
  annual: number;
};

export type SalaryBreakdownComputation = {
  rows: SalaryComponentAmount[];
  grossMonthly: number;
  grossAnnual: number;
};

const COMPONENT_LABELS: Record<keyof SalaryComponentsMonthly, string> = {
  basicMonthly: "Basic",
  hraMonthly: "HRA",
  conveyanceMonthly: "Conveyance",
  medicalMonthly: "Medical Allowances",
  specialMonthly: "Special Allowances",
};

/** Round to whole rupees — annexure amounts are always displayed without paise. */
function toWholeRupees(value: number): number {
  return Math.round(value);
}

/**
 * Deterministically derives the annual figure for each monthly component and the
 * gross totals. Pure function — no I/O, safe to unit test and reuse in both the
 * server-side validator and the PDF template.
 */
export function computeSalaryBreakdown(
  components: SalaryComponentsMonthly
): SalaryBreakdownComputation {
  const rows = (Object.keys(COMPONENT_LABELS) as (keyof SalaryComponentsMonthly)[]).map(
    (key) => {
      const monthly = toWholeRupees(components[key]);
      return {
        label: COMPONENT_LABELS[key],
        monthly,
        annual: monthly * 12,
      };
    }
  );

  const grossMonthly = rows.reduce((sum, row) => sum + row.monthly, 0);
  const grossAnnual = rows.reduce((sum, row) => sum + row.annual, 0);

  return { rows, grossMonthly, grossAnnual };
}

/**
 * Guards against an offer letter being generated with a salary annexure that
 * doesn't foot to the offer's CTC — money calculations must be deterministic,
 * so any mismatch is a hard validation error rather than a silently-accepted
 * inconsistency between what the annexure shows and what the offer promises.
 */
export function assertSalaryBreakdownMatchesCtc(
  computation: SalaryBreakdownComputation,
  ctc: number
): void {
  const target = toWholeRupees(ctc);
  if (computation.grossAnnual !== target) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      `Salary breakup does not match the offer CTC. Annexure totals ${computation.grossAnnual.toLocaleString(
        "en-IN"
      )} but the offer CTC is ${target.toLocaleString("en-IN")}. Update the salary breakup so the components add up to the CTC.`
    );
  }
}

/** Parses/validates the raw `salaryBreakdownJson` blob into typed monthly components. */
export function parseSalaryComponents(
  value: unknown
): SalaryComponentsMonthly | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const keys: (keyof SalaryComponentsMonthly)[] = [
    "basicMonthly",
    "hraMonthly",
    "conveyanceMonthly",
    "medicalMonthly",
    "specialMonthly",
  ];

  const result = {} as SalaryComponentsMonthly;
  for (const key of keys) {
    const raw = record[key];
    const num = typeof raw === "number" ? raw : Number(raw);
    if (raw == null || !Number.isFinite(num) || num < 0) return null;
    result[key] = num;
  }
  return result;
}
