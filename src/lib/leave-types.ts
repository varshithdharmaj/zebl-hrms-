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
  "expiry",
] as const;
export type LeaveTransactionType = (typeof TRANSACTION_TYPES)[number];

// Annual/monthly entitlement amounts (CL, SL, EL accrual, EL eligibility) are
// configured via LeavePolicySettings (see src/lib/leave/leave-policy.ts) —
// not hardcoded here. There used to be fixed defaults in this file; they were
// removed because they silently diverged from the configured policy.

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
