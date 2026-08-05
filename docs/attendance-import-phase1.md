# Attendance import — Phase 1 architecture (report detection)

Foundation for multi-format attendance uploads. **No Summary parser yet.** Import / DB write paths are unchanged.

## Architecture

```
Admin UploadForm
  └─ uploadAttendanceAction
       ├─ validateAttendanceUploadFile → format: excel | pdf
       ├─ parseAttendanceFile          ← NEW dispatch entry
       │    ├─ detectAttendanceReportType()
       │    │     EXCEL_DAILY | PDF_DAILY | PDF_SUMMARY | UNKNOWN
       │    ├─ EXCEL_DAILY  → parseAttendanceExcel (unchanged)
       │    ├─ PDF_*        → parseAttendancePdf
       │    │     ├─ unpdf extractText
       │    │     ├─ detectAttendanceReportType(extractedText)
       │    │     ├─ PDF_SUMMARY → "Summary PDF reports are not supported yet."
       │    │     └─ PDF_DAILY / UNKNOWN → parseAttendancePdfText (unchanged)
       │    └─ (no row parsing for Summary)
       └─ importAttendanceRows
            attendanceDate = row.attendanceDate ?? formDate  ← Phase 2
```

## Report types

| Type | Meaning | Phase 1 behavior |
|------|---------|------------------|
| `EXCEL_DAILY` | Excel daily flat table | Existing Excel parser |
| `PDF_DAILY` | PDF daily flat table | Existing PDF text parser |
| `PDF_SUMMARY` | Multi-section summary PDF | Hard error — no partial parse |
| `UNKNOWN` | Unclassified | PDF: still run daily text parser (preserve accept/reject) |

## Detection inputs

`detectAttendanceReportType()` inspects:

- file extension / validated `format`
- optional `headers`
- optional `extractedText` (PDF)
- document structure cues (titles, flat vs date-table headers, section labels, repeated Totals)

Detection is **conservative** for `PDF_SUMMARY` (title or strong section structure). Unclassified PDF text defaults to `PDF_DAILY` so existing parser behavior is preserved.

## Files

| File | Role |
|------|------|
| `src/lib/attendance/import/types.ts` | `AttendanceReportType`, summary error constant |
| `src/lib/attendance/import/detect-report-type.ts` | Detector |
| `src/lib/attendance/import/parse-dispatch.ts` | `parseAttendanceFile` entry |
| `src/lib/attendance/import/parse-pdf.ts` | Extract → detect → dispatch |
| `src/actions/upload.ts` | Calls `parseAttendanceFile` |
| `tests/unit/attendance-import-report-detection.test.ts` | Detector unit tests |

## Later phases

- [Phase 2 — per-row dates](./attendance-import-phase2.md)
- [Phase 3A — structured PDF extraction](./attendance-import-phase3a.md)
- [Phase 4 — eSSL Summary PDF parser](./attendance-import-phase4.md)
- [Phase 5 — import preview & validation](./attendance-import-phase5.md)
- Shared store for preview cache (multi-instance)
