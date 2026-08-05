# Attendance import — Phase 3A (structured PDF extraction)

Extraction infrastructure only. **No Summary parser.** No DB / UI / Excel /
Daily parse-logic changes beyond swapping the PDF read path to extract-once.

## Architecture

```
PDF bytes
    │
    ▼
extractAttendancePdf()          ← read once (unpdf extractTextItems)
    │
    ▼
PdfDocument
  pages[]
    pageNumber
    text
    items[]  { text, x, y, width?, height?, hasEOL?, … }
    │
    ├──► mergedText adapter
    │      pageTexts.join("\\n").replace(/\\s+/g, " ")
    │      (identical to former extractText({ mergePages: true }))
    │         │
    │         ▼
    │      detectAttendanceReportType
    │         │
    │         ▼
    │      parseAttendancePdfText  (Daily — unchanged)
    │
    └──► (Phase 4) parseAttendancePdfSummary — eSSL Summary state machine
```

## Extraction model

| Type | Purpose |
|------|---------|
| `PdfTextItem` | One PDF.js text run with geometry |
| `PdfPage` | Page number + rebuilt text + items |
| `PdfDocument` | Ordered pages (`totalPages`) |
| `AttendancePdfExtraction` | `{ document, mergedText }` |

### Available unpdf fields (captured)

`str`→`text`, `x`, `y`, `width`, `height`, `fontSize`, `fontFamily`, `dir`, `hasEOL`

Borders / table operators are **not** available from text extraction.

## Backward compatibility

- Daily path still consumes **merged text** only.
- Merge algorithm matches unpdf `mergePages: true` exactly.
- Detection + `parseAttendancePdfText` unchanged.
- Excel / importer / DB / UI untouched.

## Files

| File | Role |
|------|------|
| `pdf-document.ts` | Types |
| `pdf-extraction-adapters.ts` | Page text + merge adapters (pure) |
| `extract-pdf.ts` | Single-pass unpdf extraction |
| `parse-pdf.ts` | Uses extraction → merged text → Daily |

## Out of scope (Phase 4+)

- Summary section / totals detection
- Geometry-based table reconstruction
- Changing Daily parser to consume pages/items
