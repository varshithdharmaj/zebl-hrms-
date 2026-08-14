# Application File Storage

Phase 0A architecture for Recruitment documents and communication attachments.
This reuses the storage abstraction that already existed in the codebase
(`src/lib/recruitment/storage/**`) — Phase 0A did not introduce a new storage
layer, it filled the one remaining gap (communication attachments) and
documented the deployment model.

## Current deployment decision

- **AWS EC2, single instance, persistent EBS-backed filesystem.**
- No S3 for the initial deployment. No live eSSL DB integration. No Payroll
  work. These are explicitly out of scope for this phase.
- The storage boundary (`StorageAdapter`) already supports an S3 driver
  (`src/lib/recruitment/storage/s3-storage-adapter.ts`) for a future scaling
  phase — nothing here needs to change to add it later, only configuration.

## Storage adapter

```
StorageAdapter {
  save(key, data, options?): Promise<void>
  read(key): Promise<Buffer>
  delete(key): Promise<void>
  exists(key): Promise<boolean>
  getMetadata(key): Promise<StorageObjectMetadata | null>
}
```

Two implementations exist, selected by `RECRUITMENT_STORAGE_DRIVER`:

| Driver | File | Use |
|---|---|---|
| `local` (default) | `src/lib/recruitment/storage/local-storage-adapter.ts` | Dev, and the current EC2 deployment |
| `s3` | `src/lib/recruitment/storage/s3-storage-adapter.ts` | Future multi-instance scaling — not used today |

A third, `createMemoryStorageAdapter()` (`memory-storage-adapter.ts`), exists only for unit tests.

Application code never touches the filesystem directly — it calls
`getRecruitmentStorage()` (`src/lib/recruitment/storage/recruitment-storage.ts`)
and works with logical keys only. Absolute paths never leave the adapter.

## Storage root — configurable, not hard-coded

```ts
// src/lib/recruitment/storage/recruitment-storage.ts
export function getRecruitmentStorageRoot(): string {
  return (
    getEnv("RECRUITMENT_STORAGE_ROOT") ??
    path.join(process.cwd(), "storage", "recruitment")
  );
}
```

| Environment | `RECRUITMENT_STORAGE_ROOT` | Resolves to |
|---|---|---|
| Local development | unset | `backend/storage/recruitment` (relative to `process.cwd()`) |
| AWS EC2 | `/data/zebl/storage/recruitment` | `/data/zebl/storage/recruitment` |

No code path hard-codes a Windows path or an EC2 path. Set the variable per
environment; the application resolves everything through this one function.

## Logical storage keys — never absolute paths

The database (`CandidateDocument.storageKey`, `JobOpeningDocument.storageKey`,
`RecruitmentCommunicationAttachment.storagePath`) stores a **logical key**,
generated server-side, never a filesystem path:

```
candidates/<candidateId>/documents/<uuid>-<sanitized-filename>
communications/<communicationId>/attachments/<uuid>-<sanitized-filename>
offers/<offerId>/pdf/<uuid>-<sanitized-filename>
employees/<employeeId>/documents/<uuid>-<sanitized-filename>
```

Physical location = `STORAGE_ROOT + key`, resolved only inside the adapter
(`local-storage-adapter.ts` / `s3-storage-adapter.ts`). This means:

- The same DB row is portable across dev/EC2/any future S3 driver — only the
  storage root changes, not the record.
- The original filename is retained as metadata (`fileName` column) and never
  used as the physical filename — see `sanitizeStorageFileName` in
  `src/lib/recruitment/shared/storage-paths.ts`.

## Directory layout (local driver)

```
storage/recruitment/
  candidates/<candidateId>/documents/<uuid>-<file>
  communications/<communicationId>/attachments/<uuid>-<file>
  offers/<offerId>/pdf/<uuid>-<file>
  employees/<employeeId>/documents/<uuid>-<file>   # written once, at hire conversion
  recruitment/intake/<intakeId>/documents/<uuid>-<file>
```

No new top-level namespaces were added — Attendance/Payroll do not currently
store files and none were created for them.

## Security

- **Path traversal:** every key is validated before touching the filesystem —
  `assertSafeKey()` in `local-storage-adapter.ts` rejects `..`, backslashes,
  absolute paths, and double slashes, then `resolveKeyPath()` additionally
  confirms the resolved path is still inside the configured root
  (`path.relative` check). The S3 adapter has an equivalent `assertSafeKey()`.
  Both existed before Phase 0A and were verified, not rewritten.
- **No client-controlled paths:** storage keys are always generated
  server-side (`buildCandidateDocumentStorageKey`, `buildOfferPdfStorageKey`,
  `buildCommunicationAttachmentStoragePath`, etc.). As part of Phase 0A, the
  communication-attachment upload path was found to accept a client-supplied
  `storagePath` field that the server silently ignored — the field has been
  **removed** from `uploadCommunicationAttachmentSchema` so the API surface no
  longer implies a client-controlled path is honored.
- **Not publicly exposed:** the storage root lives outside `public/` and is
  never served by the Next.js static file handler. All access goes through
  authenticated, authorized routes.
- **Authorization before retrieval:** every document/attachment read goes
  Request → session → `RecruitmentScopeEngine` scope check → DB row → real
  `storageKey`/`storagePath` → `StorageAdapter.read()`. No route accepts a
  filesystem path from the client.
- **Upload validation preserved as-is:** extension + MIME allow-list + size
  limit (15MB documents, 10MB communication attachments) — unchanged by this
  phase. This is not magic-byte content verification and no antivirus service
  is wired in; `scanAttachmentForVirus()` remains an explicit no-op stub
  (`src/lib/recruitment/communication/attachment-rules.ts`) — it is not
  claimed as real scanning anywhere in the code or this document.

## Manual migration (dev → AWS EC2)

No automated migration tool was built, per explicit instruction for this
phase. To move existing local files to a new EC2 instance:

1. Copy the storage directory as-is:
   ```
   Local:  backend/storage/recruitment/
   AWS:    /data/zebl/storage/recruitment/
   ```
   `scp`, `rsync`, or an EBS snapshot restore all work — the directory
   structure and file names underneath the root are irrelevant to the
   application; only `STORAGE_ROOT + storageKey` needs to resolve to the
   right bytes.
2. Set `RECRUITMENT_STORAGE_ROOT=/data/zebl/storage/recruitment` in the EC2
   environment.
3. No database changes are required — `storageKey`/`storagePath` values in
   Postgres are already root-relative and portable.

## Deployment directory separation (EC2)

```
/opt/zebl/app/        application code — replaced on every deploy
/data/zebl/storage/    uploaded documents — EBS-backed, must survive deploys
```

Deployment scripts must never delete or recreate `/data/zebl/storage/`.
`RECRUITMENT_STORAGE_ROOT` should point at a path under this persistent
volume, not under the application code directory.

## Backup

EBS persistence is **not** a backup. This phase does not implement
application-level backup automation (none existed before, and none was
added). Production backups should use AWS-native tooling — EBS snapshots or
AWS Backup — configured at the infrastructure level, outside application code.

## Vercel

Vercel support is unmodified by this phase. Vercel's filesystem is ephemeral
per invocation/instance — the `local` storage driver must **not** be treated
as durable document storage on Vercel. If the application is ever run on
Vercel with real file uploads, it must use the `s3` driver (already
implemented) rather than `local`. This phase does not change that story; it
only documents it, since it was previously undocumented.

## Supabase

`src/utils/supabase/{server,client,middleware}.ts` define a Supabase SSR
client (`@supabase/ssr`, `@supabase/supabase-js`), but **nothing in the
application imports them** (verified by repo-wide search — zero call sites
outside their own files). Supabase Storage is not used anywhere for
Recruitment documents or attachments; document/attachment storage has always
gone through `StorageAdapter` (local/S3), never Supabase. This phase leaves
the Supabase client files untouched, per instruction not to remove Supabase
usage blindly — there is simply no active storage usage to preserve or
migrate.

## Communication attachments

Before this phase: the upload action accepted only metadata (fileName,
fileType, fileSize, a client-supplied `storagePath` string); no file bytes
were ever sent to the server or written to storage; the download and preview
API routes returned hardcoded mock content regardless of the real file.

This phase wired it into the existing storage layer, following the same
pattern already used by candidate documents:

- `AttachmentUploader` now submits the real `File` via `FormData`.
- `uploadCommunicationAttachmentAction` reads the file into a `Buffer` and
  passes it to `CommunicationService.addAttachment`.
- `addAttachment` validates, generates the storage key server-side, calls
  `StorageAdapter.save()`, then writes the DB row — with orphaned-blob cleanup
  if the DB write fails (matching `CandidateDocumentService.uploadDocument`).
- A new `getAttachmentContent()` service method performs the scope check and
  reads the real bytes back; the download and preview routes now serve those
  bytes instead of mock content.

See the Phase 0A report for full evidence and file references.
