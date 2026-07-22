import { describe, expect, it, vi } from "vitest";

const getHolidaysForRange = vi.fn();
const getApprovedLeaveForEmployeeRange = vi.fn();
const getAttendanceSettings = vi.fn();
const getDateOverridesForRange = vi.fn();

vi.mock("@/lib/leave/leave-calendar", () => ({
  getHolidaysForRange: (...args: unknown[]) => getHolidaysForRange(...args),
  getApprovedLeaveForEmployeeRange: (...args: unknown[]) => getApprovedLeaveForEmployeeRange(...args),
}));

vi.mock("@/lib/attendance/attendance-settings", () => ({
  getAttendanceSettings: (...args: unknown[]) => getAttendanceSettings(...args),
  getDateOverridesForRange: (...args: unknown[]) => getDateOverridesForRange(...args),
}));

import { classifyAttendanceRecords, dateSpanOf, type AttendanceHistoryRecordInput } from "@/lib/attendance/history-classification";

// `status` is the legacy field kept only for the admin employee-profile tab (see the
// history-classification.ts comment) — irrelevant to every test below, which exercises
// the canonical classifier, so it's defaulted here rather than repeated per fixture.
function rec(overrides: Partial<AttendanceHistoryRecordInput> & Pick<AttendanceHistoryRecordInput, "id" | "attendanceDate">): AttendanceHistoryRecordInput {
  return {
    checkIn: null,
    checkOut: null,
    workedMinutes: 0,
    overtimeMinutes: 0,
    remarks: null,
    status: "Present",
    ...overrides,
  };
}

const schedule = {
  mondayWorking: true,
  tuesdayWorking: true,
  wednesdayWorking: true,
  thursdayWorking: true,
  fridayWorking: true,
  saturdayWorking: false,
  sundayWorking: false,
  expectedWorkMinutes: 480,
};

function setupLookups(overrides: {
  holidays?: unknown[];
  leave?: unknown[];
  dateOverrides?: unknown[];
} = {}) {
  getHolidaysForRange.mockResolvedValue(overrides.holidays ?? []);
  getApprovedLeaveForEmployeeRange.mockResolvedValue(overrides.leave ?? []);
  getAttendanceSettings.mockResolvedValue(schedule);
  getDateOverridesForRange.mockResolvedValue(overrides.dateOverrides ?? []);
}

// 2026-07-20 = Monday (working by default per `schedule`).
const monday = new Date(2026, 6, 20);
const sunday = new Date(2026, 6, 19);

describe("classifyAttendanceRecords", () => {
  it("returns an empty array without querying anything when there are no records", async () => {
    setupLookups();
    const result = await classifyAttendanceRecords(1, [], monday, monday);
    expect(result).toEqual([]);
    expect(getHolidaysForRange).not.toHaveBeenCalled();
  });

  it("reclassifies a day marked 'Absent' by the raw status as LEAVE when approved leave covers it — the core bug this module fixes", async () => {
    setupLookups({ leave: [{ leaveType: "SL", startDate: monday, endDate: monday }] });
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 1, attendanceDate: monday, remarks: "marked absent by upload, later approved as sick leave" })],
      monday,
      monday
    );
    expect(result.category).toBe("LEAVE");
  });

  it("classifies a normal present day using the canonical ratio tiers", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 2, attendanceDate: monday, checkIn: "09:00", checkOut: "18:00", workedMinutes: 480 })],
      monday,
      monday
    );
    expect(result.category).toBe("PRESENT");
    expect(result.ratioTier).toBe("target");
    expect(result.expectedWorkMinutes).toBe(480);
  });

  it("flags late arrival and early checkout from remarks, same detection hero-status.ts uses", async () => {
    setupLookups();
    const [late, early] = await classifyAttendanceRecords(
      1,
      [
        rec({
          id: 3,
          attendanceDate: monday,
          checkIn: "09:45",
          checkOut: "18:00",
          workedMinutes: 495,
          remarks: "Late arrival, approved by manager",
        }),
        rec({
          id: 4,
          attendanceDate: monday,
          checkIn: "09:00",
          checkOut: "16:00",
          workedMinutes: 420,
          remarks: "Early checkout for appointment",
        }),
      ],
      monday,
      monday
    );
    expect(late.late).toBe(true);
    expect(late.earlyCheckout).toBe(false);
    expect(early.earlyCheckout).toBe(true);
    expect(early.late).toBe(false);
  });

  it("classifies a Sunday with a punch as WORKED_ON_WEEKLY_OFF, not plain Present", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 5, attendanceDate: sunday, checkIn: "10:00", checkOut: "14:00", workedMinutes: 240, overtimeMinutes: 240 })],
      sunday,
      sunday
    );
    expect(result.category).toBe("WORKED_ON_WEEKLY_OFF");
  });

  it("classifies a check-in with no checkout and zero worked minutes as INSUFFICIENT_DATA, not Short Hours", async () => {
    setupLookups();
    const [result] = await classifyAttendanceRecords(
      1,
      [rec({ id: 6, attendanceDate: monday, checkIn: "09:00", remarks: "missing checkout" })],
      monday,
      monday
    );
    expect(result.category).toBe("INSUFFICIENT_DATA");
  });

  it("matches each record to its own date's holiday/leave/override, not a neighbor's", async () => {
    const tuesday = new Date(2026, 6, 21);
    setupLookups({
      holidays: [{ name: "Founders Day", holidayDate: monday }],
    });
    const [mondayResult, tuesdayResult] = await classifyAttendanceRecords(
      1,
      [rec({ id: 7, attendanceDate: monday }), rec({ id: 8, attendanceDate: tuesday })],
      monday,
      tuesday
    );
    expect(mondayResult.category).toBe("HOLIDAY");
    expect(tuesdayResult.category).toBe("ABSENT");
  });
});

describe("dateSpanOf", () => {
  it("returns the min and max attendanceDate across records", () => {
    const a = new Date(2026, 5, 1);
    const b = new Date(2026, 5, 15);
    const c = new Date(2026, 5, 8);
    const { start, end } = dateSpanOf([{ attendanceDate: a }, { attendanceDate: b }, { attendanceDate: c }]);
    expect(start.getTime()).toBe(a.getTime());
    expect(end.getTime()).toBe(b.getTime());
  });
});
