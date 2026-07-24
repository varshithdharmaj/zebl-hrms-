/**

 * Attendance shift filter + display (view layer).

 * Source of truth: Employee.shift — not attendance_records.shift or punch times.

 */



export type EmployeeShiftFilterValue = "" | "morning" | "night" | "us" | "general";



export type EmployeeShiftFilterOption = {

  value: EmployeeShiftFilterValue;

  /** Canonical label stored on Employee.shift */

  label: string;

};



export const EMPLOYEE_SHIFT_FILTERS: EmployeeShiftFilterOption[] = [

  { value: "", label: "All Shifts" },

  { value: "morning", label: "Morning Shift" },

  { value: "night", label: "Night Shift" },

  { value: "us", label: "US Shift" },

  { value: "general", label: "General Shift" },

];



/** Profile / HR assignment options (same labels as filters, minus "All") */

export const EMPLOYEE_SHIFT_ASSIGNMENT_OPTIONS = EMPLOYEE_SHIFT_FILTERS.filter(

  (o) => o.value !== ""

);

/** Payroll + operational attendance filters (day/night teams) */

export const OPERATIONAL_SHIFT_FILTERS = EMPLOYEE_SHIFT_FILTERS.filter(

  (o) => o.value === "" || o.value === "morning" || o.value === "night"

);

export function isOperationalShiftFilterValue(

  value: string | undefined

): value is EmployeeShiftFilterValue {

  return OPERATIONAL_SHIFT_FILTERS.some((f) => f.value === value);

}

export function getOperationalShiftFilterOption(value: string | undefined) {

  if (!value || !isOperationalShiftFilterValue(value)) {

    return OPERATIONAL_SHIFT_FILTERS[0];

  }

  return OPERATIONAL_SHIFT_FILTERS.find((f) => f.value === value) ?? OPERATIONAL_SHIFT_FILTERS[0];

}

export function isEmployeeShiftFilterValue(

  value: string | undefined

): value is EmployeeShiftFilterValue {

  return EMPLOYEE_SHIFT_FILTERS.some((f) => f.value === value);

}



export function getShiftFilterOption(value: string | undefined) {

  if (!value || !isEmployeeShiftFilterValue(value)) {

    return EMPLOYEE_SHIFT_FILTERS[0];

  }

  return EMPLOYEE_SHIFT_FILTERS.find((f) => f.value === value) ?? EMPLOYEE_SHIFT_FILTERS[0];

}



/** Prisma where: filter attendance by assigned employee.shift */

export function buildEmployeeShiftWhere(shiftFilter: string | undefined) {

  const option = getShiftFilterOption(shiftFilter);

  if (!option.value) return undefined;



  return {

    employee: {

      shift: { equals: option.label, mode: "insensitive" as const },

    },

  };

}



/** Display assigned employee shift as stored on profile */

export function formatEmployeeShiftDisplay(shift: string | null | undefined): string {

  const trimmed = shift?.trim();

  return trimmed ? trimmed : "—";

}



export function getEmployeeShiftBadgeVariant(

  shift: string | null | undefined

): "morning" | "night" | "us" | "general" | "default" {

  if (!shift?.trim()) return "default";

  const normalized = shift.trim().toLowerCase();

  for (const opt of EMPLOYEE_SHIFT_FILTERS) {

    if (!opt.value) continue;

    if (normalized === opt.label.toLowerCase()) return opt.value;

  }

  return "default";

}



/** Parse HH:mm or HH:mm:ss (24h) or pass through existing AM/PM text */

export function formatTimeAmPm(value: string | null | undefined): string {

  if (!value) return "—";

  const trimmed = value.trim();

  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "na") return "—";



  if (/\b(am|pm)\b/i.test(trimmed)) {

    return normalizeAmPmString(trimmed);

  }



  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return trimmed;



  let hours = parseInt(match[1], 10);

  const minutes = match[2];

  if (Number.isNaN(hours)) return trimmed;



  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) hours = 12;

  else if (hours > 12) hours -= 12;



  return `${hours}:${minutes} ${period}`;

}



function normalizeAmPmString(value: string): string {

  const m = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (m) {

    const h = parseInt(m[1], 10);

    const min = m[2];

    const period = m[3].toUpperCase();

    return `${h}:${min} ${period}`;

  }

  return value;

}



export function formatShiftTimeRange(

  checkIn: string | null | undefined,

  checkOut: string | null | undefined

): string {

  const inFmt = formatTimeAmPm(checkIn);

  const outFmt = formatTimeAmPm(checkOut);

  if (inFmt === "—" && outFmt === "—") return "";

  if (inFmt === "—") return outFmt;

  if (outFmt === "—") return inFmt;

  return `${inFmt} → ${outFmt}`;

}



export function formatWorkedDurationDisplay(

  workDuration: string | null | undefined,

  workedMinutes: number

): string {

  if (workDuration?.trim()) {

    const parsed = workDuration.trim();

    if (/h|m/i.test(parsed) || parsed.includes(":")) {

      return parsed;

    }

  }

  if (workedMinutes <= 0) return "—";

  return formatHoursMinutes(workedMinutes);

}



export function formatOvertimeDisplay(overtimeMinutes: number): string {

  if (overtimeMinutes <= 0) return "—";

  return `${formatHoursMinutes(overtimeMinutes)} OT`;

}



function formatHoursMinutes(minutes: number): string {

  const h = Math.floor(minutes / 60);

  const m = minutes % 60;

  if (h === 0) return `${m}m`;

  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;

}


