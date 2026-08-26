export const LEAVE_TYPES = ["EL", "CL", "SL"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  EL: "Earned Leave",
  CL: "Casual Leave",
  SL: "Sick Leave",
};

export const TRANSACTION_TYPES = [
  "accrual",
  "deduction",
  "manual_adjustment",
] as const;
export type LeaveTransactionType = (typeof TRANSACTION_TYPES)[number];

export const DEFAULT_CL_ANNUAL = 12;
export const DEFAULT_SL_ANNUAL = 12;
export const EL_MONTHLY_ACCRUAL = 0.5;
export const EL_ELIGIBILITY_YEARS = 1;

export function isValidLeaveType(value: string): value is LeaveType {
  return LEAVE_TYPES.includes(value as LeaveType);
}

export function formatLeaveDays(days: number): string {
  if (days % 1 === 0) return String(days);
  return days.toFixed(1);
}

export function leaveTypeToBalanceField(
  leaveType: LeaveType
): "elBalance" | "clBalance" | "slBalance" {
  switch (leaveType) {
    case "EL":
      return "elBalance";
    case "CL":
      return "clBalance";
    case "SL":
      return "slBalance";
  }
}
