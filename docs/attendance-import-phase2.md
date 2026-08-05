# Attendance import — Phase 2 contract (per-row dates)

Extends the normalized import contract so each row may carry its own
`attendanceDate`, while Excel Daily and PDF Daily remain form-date driven.

**No Summary PDF parser in this phase.** No DB / UI changes.

## Architecture

```
Upload Form
  │  attendanceDate (form)
  ▼
validateAttendanceUploadFile
  ▼
detectAttendanceReportType
  ▼
Parser (Excel Daily / PDF Daily)
  │  stamps source; does NOT set attendanceDate
  ▼
AttendanceImportRow
  │  attendanceDate?   source: EXCEL_DAILY | PDF_DAILY | …
  ▼
importAttendanceRows
  │
  │  attendanceDate = row.attendanceDate ?? formAttendanceDate
  │  (sole fallback site)
  ▼
AttendanceRecord / AttendanceSession  (schema unchanged)
```

## Contract

```ts
type AttendanceImportRow = {
  employeeCode: string;
  employeeName: string;
  shift: string;
  inTime: unknown;
  outTime: unknown;
  workDuration: string;
  ot: string | number | null | undefined; // overtime (legacy name)
  status: string;
  remarks: string;
  attendanceDate?: Date;  // parser-owned when known
  source: AttendanceReportType; // in-memory only
};
```

| Producer | `source` | `attendanceDate` |
|----------|----------|------------------|
| Excel Daily | `EXCEL_DAILY` | omitted → form date |
| PDF Daily | `PDF_DAILY` | omitted → form date |
| PDF Summary (future) | `PDF_SUMMARY` | set per row |

## Backward compatibility

- Excel / Daily PDF parsers unchanged in row content (times, durations, status).
- Importer still uses form date when `attendanceDate` is absent → identical DB writes.
- Duplicate detection, PDF unknown-employee rejection, Excel auto-create unchanged.
- Prisma schema / migrations unchanged.

## Files

| File | Role |
|------|------|
| `types.ts` | Row contract + `resolveImportAttendanceDate` |
| `normalize-matrix.ts` | Stamps `source`; no row date |
| `parse-excel.ts` / `parse-pdf-text.ts` | Pass report source into normalize |
| `import-records.ts` | Per-row date fallback |
| `docs/attendance-import-phase1.md` | Detection (Phase 1) |

## Out of scope

- Summary PDF parsing
- Upload UI changes
- Multi-date UX
- Schema / migrations
