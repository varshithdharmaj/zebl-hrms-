# Attendance import — Phase 5B (optional preview)

Preview infrastructure from Phase 5 remains intact. Default UX is direct import.

## Before / after

**Phase 5 (always preview):**

```
Upload → Preview → Confirm → Import → Result
```

**Phase 5B (flagged):**

```
ENABLE_ATTENDANCE_IMPORT_PREVIEW=false  (default)
Upload → parseAttendanceFile → importAttendanceRows → Result

ENABLE_ATTENDANCE_IMPORT_PREVIEW=true
Upload → Preview → Confirm → Import → Result  (Phase 5)
```

## Feature flag

| Key | Default | Location |
|-----|---------|----------|
| `ENABLE_ATTENDANCE_IMPORT_PREVIEW` | `false` | `.env` / `.env.example` |
| `isAttendanceImportPreviewEnabled()` | reads env | `src/lib/config/attendance-import.ts` |
| `attendanceImportConfig.previewEnabled` | getter | same |

Passed from the upload page (server) into `UploadForm` as `previewEnabled`.

## Workflows

| Mode | UI entry | Server action | Shared logic |
|------|----------|---------------|--------------|
| Direct (default) | `UploadFormDirect` | `uploadAttendanceAction` | `parseAttendanceFile` + `importAttendanceRows` |
| Preview | `UploadFormPreview` | `previewAttendanceAction` → `confirmAttendanceImportAction` | same parsers/importer + preview cache |

## Files

| File | Role |
|------|------|
| `src/lib/config/attendance-import.ts` | Flag |
| `upload-form.tsx` | Switches Direct vs Preview |
| `upload-form-direct.tsx` | Default UX |
| `upload-form-preview.tsx` | Phase 5 UX (preserved) |
| `actions/upload.ts` | Direct import (+ Summary date fallback) |
| Preview modules / actions / panel / tests | **Unchanged / kept** |

## Backward compatibility

- Excel / Daily / Summary parsers untouched
- `importAttendanceRows` untouched
- No schema changes
- Phase 5 preview tests still valid when flag is on
- Legacy direct upload tests still cover `uploadAttendanceAction`
