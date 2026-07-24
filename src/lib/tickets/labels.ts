/** Display labels for ticket category enum values. */
export const CATEGORY_LABELS: Record<string, string> = {
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
  salary: "Salary",
  it_technical: "IT/Technical",
  hr: "HR",
  workplace: "Workplace",
  facilities: "Facilities",
  suggestion: "Suggestion",
  other: "Other",
};

/** Tailwind class strings for ticket priority badges. */
export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};
