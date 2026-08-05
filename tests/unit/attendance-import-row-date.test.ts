import { describe, expect, it } from "vitest";
import { resolveImportAttendanceDate } from "@/lib/attendance/import/types";

describe("resolveImportAttendanceDate", () => {
  const formDate = new Date("2026-07-24T00:00:00.000Z");

  it("falls back to the upload-form date when the row has no date", () => {
    expect(resolveImportAttendanceDate({}, formDate)).toBe(formDate);
    expect(resolveImportAttendanceDate({ attendanceDate: undefined }, formDate)).toBe(
      formDate
    );
  });

  it("prefers the row attendanceDate when present", () => {
    const rowDate = new Date("2026-07-16T00:00:00.000Z");
    expect(resolveImportAttendanceDate({ attendanceDate: rowDate }, formDate)).toBe(
      rowDate
    );
  });
});
