import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_IMPORT_PARSER_VERSION,
  IMPORT_CHUNK_SIZE,
  compressPayload,
  decompressPayload,
} from "@/lib/attendance/import/import-job-payload";
import type { AttendanceImportRow } from "@/lib/attendance/import/types";

function sampleRow(partial?: Partial<AttendanceImportRow>): AttendanceImportRow {
  return {
    employeeCode: partial?.employeeCode ?? "660005",
    employeeName: partial?.employeeName ?? "Madhukar",
    shift: partial?.shift ?? "GS",
    inTime: partial?.inTime ?? "09:00",
    outTime: partial?.outTime ?? "18:00",
    workDuration: partial?.workDuration ?? "09:00",
    ot: partial?.ot ?? "0",
    status: partial?.status ?? "Present",
    remarks: partial?.remarks ?? "",
    attendanceDate: partial?.attendanceDate,
    source: partial?.source ?? "PDF_DAILY",
  };
}

describe("import-job-payload", () => {
  it("exposes chunk size 15 and parser version", () => {
    expect(IMPORT_CHUNK_SIZE).toBe(15);
    expect(ATTENDANCE_IMPORT_PARSER_VERSION).toBe("1");
  });

  it("round-trips rows including attendance dates", () => {
    const date = new Date("2026-07-29T00:00:00.000Z");
    const rows = [
      sampleRow({ attendanceDate: date }),
      sampleRow({ employeeCode: "GHOST", attendanceDate: undefined }),
    ];
    const compressed = compressPayload(rows);
    expect(Buffer.isBuffer(compressed)).toBe(true);
    expect(compressed.byteLength).toBeGreaterThan(0);

    const restored = decompressPayload(compressed);
    expect(restored).toHaveLength(2);
    expect(restored[0].employeeCode).toBe("660005");
    expect(restored[0].attendanceDate).toBeInstanceOf(Date);
    expect(restored[0].attendanceDate!.toISOString()).toBe(date.toISOString());
    expect(restored[1].attendanceDate).toBeUndefined();
  });
});
