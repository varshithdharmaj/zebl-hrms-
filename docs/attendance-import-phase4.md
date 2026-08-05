# Attendance import — Phase 4 (eSSL Summary PDF parser)

Implements Summary Attendance PDF support for the **known eSSL Summary Report**
layout only. Uses Phase 3A `PdfDocument` (pages / lines / items). No OCR.

## Architecture

```
PDF bytes
    │
    ▼
extractAttendancePdf()          ← once
    │
    ├── mergedText ──► detectAttendanceReportType
    │                      │
    │         PDF_DAILY ───┼──► parseAttendancePdfText (unchanged)
    │         PDF_SUMMARY──┘
    │                      │
    └── PdfDocument ───────┴──► parseAttendancePdfSummary (state machine)
                                      │
                                      ▼
                               AttendanceImportRow[]
                                 attendanceDate set
                                 source = PDF_SUMMARY
                                      │
                                      ▼
                               importAttendanceRows
                                 (row date; form date ignored)
```

## Parser state machine

```
SEARCH_EMPLOYEE
      │  Employee Code: <code>
      ▼
READ_EMPLOYEE_HEADER
      │  Employee Name: <name>
      ▼
READ_TABLE_HEADER
      │  Date / In Time / Out Time / …
      ▼
READ_ATTENDANCE_ROWS
      │  date rows → import rows
      │  repeated table header (page break) → ignore
      │  Employee Code → next section
      │  Totals →
      ▼
SKIP_TOTALS
      │  skip total/grand-total noise
      │  Employee Code → SEARCH path via READ_EMPLOYEE_HEADER
      └──► SEARCH_EMPLOYEE (via header read)
```

## Supported layout

eSSL Summary / Attendance Summary style:

- Employee Code / Employee Name section labels
- Per-employee table: Date, In Time, Out Time, Shift, Total Duration, Status, Remarks
- Totals / Grand Totals (ignored as data)
- Multi-page sections with repeated headers
- Weekend / Holiday / Leave / blank / missing Out Time rows

## Unsupported

- Daily flat biometric tables (use Daily parser)
- Scanned / image-only PDFs
- Arbitrary or unknown vendor layouts
- Free-form text reports

## Files

| File | Role |
|------|------|
| `summary-line-stream.ts` | PdfDocument → page lines |
| `parse-pdf-summary.ts` | State machine parser |
| `parse-pdf.ts` | Dispatch PDF_SUMMARY → summary parser |
| `tests/fixtures/essl-summary-pdf.ts` | Anonymized fixtures |
| `tests/unit/attendance-import-pdf-summary.test.ts` | Coverage |

## Remaining limitations

- Column order is fixed to the eSSL Summary template
- Compact single-space rows are only accepted when the first token is a date
- OT is typically absent in Summary exports (`ot` left empty)
- Detection still uses merged text; parsing uses structured pages
