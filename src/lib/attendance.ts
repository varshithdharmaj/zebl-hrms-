//here 480 is the threshold for present status
const PRESENT_THRESHOLD_MINUTES = 480;

export type AttendanceStatus = "Present" | "Short Hours" | "Absent";

export function parseDurationToMinutes(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.round(value * (value < 24 ? 60 : 1));
  }

  const str = String(value).trim();
  if (!str) return 0;

  const numeric = Number(str);
  if (!Number.isNaN(numeric)) {
    if (str.includes(".") && numeric < 24) {
      return Math.round(numeric * 60);
    }
    return Math.round(numeric);
  }

  const colonMatch = str.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    const seconds = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const hmMatch = str.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m?/i);
  if (hmMatch) {
    const hours = parseInt(hmMatch[1], 10);
    const minutes = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0;
    return hours * 60 + minutes;
  }

  return 0;
}

export function parseOTToMinutes(value: string | number | null | undefined): number {
  return parseDurationToMinutes(value);
}

export function hasCheckIn(checkIn: string | null | undefined): boolean {
  if (!checkIn) return false;
  const trimmed = checkIn.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "na") return false;
  return true;
}

export function deriveAttendanceStatus(
  checkIn: string | null | undefined,
  workedMinutes: number
): AttendanceStatus {
  if (!hasCheckIn(checkIn)) return "Absent";
  if (workedMinutes >= PRESENT_THRESHOLD_MINUTES) return "Present";
  return "Short Hours";
}

export const EXPECTED_EXCEL_COLUMNS = [
  "Employee Code",
  "Employee Name",
  "Shift",
  "In Time",
  "Out Time",
  "Work Duration",
  "OT",
  "Status",
  "Remarks",
] as const;

export const COLUMN_ALIASES: Record<string, string[]> = {
  "employee code": ["employee code", "e. code", "e code", "code", "emp code", "emp. code"],
  "employee name": ["employee name", "name", "emp name", "emp. name", "employee_name"],
  "shift": ["shift"],
  "in time": ["in time", "intime", "in_time", "check in", "checkin"],
  "out time": ["out time", "outtime", "out_time", "check out", "checkout"],
  "work duration": ["work duration", "work dur.", "work dur", "work_duration", "duration"],
  "ot": ["ot", "overtime", "over time"],
  "status": ["status"],
  "remarks": ["remarks", "remark"],
};

export function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateExcelColumns(headers: string[]): string | null {
  const normalized = headers.map(normalizeColumnName);

  for (const expectedCol of EXPECTED_EXCEL_COLUMNS) {
    const key = normalizeColumnName(expectedCol);
    const aliases = COLUMN_ALIASES[key] ?? [key];
    const hasMatch = aliases.some((alias) => normalized.includes(alias));
    if (!hasMatch) {
      return `Missing required column: ${expectedCol}`;
    }
  }
  return null;
}

export function getColumnIndex(headers: string[], columnName: string): number {
  const normalized = headers.map(normalizeColumnName);
  const key = normalizeColumnName(columnName);
  const aliases = COLUMN_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}
