import { gunzipSync, gzipSync } from "node:zlib";
import type { AttendanceImportRow, AttendanceReportType } from "./types";

/** Rows processed per committed DB transaction during job import. */
export const IMPORT_CHUNK_SIZE = 15;

/** Bump when serialized row shape changes. */
export const ATTENDANCE_IMPORT_PARSER_VERSION = "1";

type SerializedImportRow = Omit<AttendanceImportRow, "attendanceDate" | "source"> & {
  attendanceDate?: string;
  source: AttendanceReportType;
};

type PayloadEnvelope = {
  version: string;
  rows: SerializedImportRow[];
};

function serializeRow(row: AttendanceImportRow): SerializedImportRow {
  return {
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    shift: row.shift,
    inTime: row.inTime,
    outTime: row.outTime,
    workDuration: row.workDuration,
    ot: row.ot,
    status: row.status,
    remarks: row.remarks,
    source: row.source,
    ...(row.attendanceDate instanceof Date && !Number.isNaN(row.attendanceDate.getTime())
      ? { attendanceDate: row.attendanceDate.toISOString() }
      : {}),
  };
}

function deserializeRow(row: SerializedImportRow): AttendanceImportRow {
  const attendanceDate =
    typeof row.attendanceDate === "string" && row.attendanceDate.length > 0
      ? new Date(row.attendanceDate)
      : undefined;

  return {
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    shift: row.shift,
    inTime: row.inTime,
    outTime: row.outTime,
    workDuration: row.workDuration,
    ot: row.ot,
    status: row.status,
    remarks: row.remarks,
    source: row.source,
    ...(attendanceDate && !Number.isNaN(attendanceDate.getTime())
      ? { attendanceDate }
      : {}),
  };
}

/**
 * Compress parsed import rows for durable job storage (gzip JSON).
 * Dates are stored as ISO strings.
 */
export function compressPayload(rows: AttendanceImportRow[]): Uint8Array<ArrayBuffer> {
  const envelope: PayloadEnvelope = {
    version: ATTENDANCE_IMPORT_PARSER_VERSION,
    rows: rows.map(serializeRow),
  };
  const gzipped = gzipSync(Buffer.from(JSON.stringify(envelope), "utf8"));
  const bytes = new Uint8Array(gzipped.byteLength);
  bytes.set(gzipped);
  return bytes;
}

/**
 * Decompress a job payload back into typed import rows.
 */
export function decompressPayload(bytes: Uint8Array | Buffer): AttendanceImportRow[] {
  const json = gunzipSync(Buffer.from(bytes)).toString("utf8");
  const parsed = JSON.parse(json) as PayloadEnvelope;
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("Invalid attendance import payload.");
  }
  return parsed.rows.map(deserializeRow);
}
