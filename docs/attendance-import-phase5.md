# Attendance import — Phase 5 (preview & validation)

Introduces a parse-once **preview → confirm** workflow. Parsers, importer, and
schema are unchanged.

## Architecture

```
Upload Form
    │
    ▼
previewAttendanceAction
    │  validate file
    │  parseAttendanceFile()          ← once
    │  buildAttendanceImportPreview() ← batched employee/duplicate checks
    │  putAttendancePreviewCache()
    ▼
AttendanceImportPreview (UI)
    │
    ├─ Cancel → deleteAttendancePreviewCache
    │
    └─ Confirm → confirmAttendanceImportAction
           getAttendancePreviewCache()   ← reuse rows (no re-parse)
           importAttendanceRows()        ← unchanged transactional importer
           delete cache + revalidate
```

## Validation

| Check | Severity | Confirm impact |
|-------|----------|----------------|
| Missing employee code | Error | Row not importable |
| Missing/invalid date (Summary) | Error | Row not importable |
| Unknown employee (PDF) | Warning | Skipped |
| Unknown employee (Excel) | Warning | Will auto-create |
| Duplicate date | Warning | Skipped by importer |
| Unusual time / status | Warning | Still importable |

`canConfirm` requires ≥1 importable row and no structural “no rows / all unknown PDF” errors.

## Summary PDF UX

- After preview with `PDF_SUMMARY`: dates come from file; banner explains this.
- Form attendance date is optional for Summary preview; required for Daily Excel/PDF.

## Cache

In-memory `Map` on `globalThis`, 30-minute TTL, scoped by `userId`. No schema.
Suitable for single-node deployments; multi-instance would need shared store later.

## Files

| File | Role |
|------|------|
| `preview-types.ts` | Preview contract |
| `preview-cache.ts` | TTL cache |
| `build-preview.ts` | Validation + summary |
| `actions/upload-preview.ts` | Preview / confirm / cancel |
| `attendance-import-preview-panel.tsx` | Preview UI |
| `upload-form.tsx` | Multi-step UX |
| `actions/upload.ts` | Legacy direct import (kept) |

## Out of scope (later)

- Shared store for preview cache (multi-instance)
- Set `ENABLE_ATTENDANCE_IMPORT_PREVIEW=true` to use this UI in production
