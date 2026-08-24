# Public Apply — temporary storage lifecycle & operational cleanup

Scope: `storage/recruitment/public-intake/YYYY-MM/{submissionId}/resume.ext`.
Does **not** apply to `storage/recruitment/candidates/{candidateId}/...` —
those are permanent `CandidateDocument` files and must never be touched by
any cleanup process described here.

## What the system already does automatically (no cron required)

1. **Successful submission** — the temp file is copied into
   `candidates/{candidateId}/documents/...` as a real `CandidateDocument`,
   then the temp file is deleted, in `attachResumeBestEffort()`
   (`src/lib/recruitment/public-apply/public-application-service.ts`).
2. **Lazy expiry** — any request against a `PublicApplicationSubmission`
   whose `expiresAt` has passed transitions it to `EXPIRED` and deletes its
   temp file on that same request, in `loadAndVerify()`/`expireSubmission()`
   in the same file. This mirrors `ApprovalToken`'s `markExpiredIfNeeded()`.

**The gap this doesn't cover:** a submission that is *abandoned and never
revisited* — the candidate closes the tab after uploading a resume and never
comes back — sits in the DB in a non-terminal state (`resume_uploaded`,
`parsing`, `ready_for_review`, etc.) with its temp file on disk, forever,
because lazy expiry only fires on access. This is a known, accepted V1 gap
(confirmed by real testing during hardening — orphaned files were observed
after abandoned/crashed test runs and had to be cleaned up manually).

## What is safe to archive or delete, and how to tell

A file under `public-intake/{month}/{submissionId}/` is safe to remove once
**either**:

- the corresponding `PublicApplicationSubmission` row's `status` is
  `submitted` (implies the file was already copied to `candidates/*` and the
  temp copy already deleted — if it's still on disk, the copy step failed
  and the file is an orphan, safe to remove independently of the DB row), **or**
- the row's `status` is `expired`, **or**
- **no row exists at all** for that `submissionId` (the surest signal — a
  temp file with no owning row can never become a permanent document).

A whole `public-intake/{month}/` directory is safe to archive/delete once
every submission created in that month has reached one of the terminal
states above — in practice, once the month is at least `expiresAt`'s TTL
(48h) old, every row created in it has necessarily either submitted or
expired, so **a full month directory older than ~2 days past month-end is
safe to archive wholesale** without needing to cross-reference the DB at all.
This is the reason the storage layout is month-partitioned in the first
place — see `buildPublicIntakeStorageKey()` / `monthPartitionFor()` in
`src/lib/recruitment/shared/storage-paths.ts`.

**Never** delete anything under `candidates/{candidateId}/...` — that is the
permanent record. The temp/permanent split (separate top-level directories)
exists specifically so a bulk archive/delete pass over `public-intake/` can
never touch a real `CandidateDocument`, even by operator error.

## Recommended operational process today (manual, no new infra)

Once a month, an operator can safely `tar`/move/delete any
`public-intake/YYYY-MM/` directory more than ~2 days past the end of that
month. No DB query is required first, per the reasoning above.

## If/when a cleanup endpoint becomes worth building

Not implemented now — this repo has no committed cron/scheduler
(`docs/DEVELOPMENT.md`/Phase-3 audit: `CRON_PUBLIC_PATHS` routes are
triggered by an external scheduler outside this repo, e.g.
`/api/notifications/process`). If abandoned-submission volume ever makes
manual monthly cleanup impractical, the natural design — matching the
existing cron-route pattern exactly — would be:

- `POST /api/recruitment/public-apply/cleanup`, Bearer-secret authenticated
  via the same `authorizeCronOrAdmin()` helper already used by
  `/api/notifications/process` (`src/lib/auth/cron-auth.ts`) — no new auth
  mechanism.
- Body of the job: find `PublicApplicationSubmission` rows past `expiresAt`
  that are still non-terminal (the lazy-expire path never ran because
  nothing re-accessed them), transition them to `EXPIRED`, delete their temp
  files — i.e., just *force* the same `expireSubmission()` logic that
  already exists, on a schedule, instead of waiting for access.
- Wire it into whatever external scheduler already calls the other
  `CRON_PUBLIC_PATHS` routes — no new scheduler dependency, same operational
  pattern already in production for notifications/integrations/analytics.

This is intentionally not built now, per explicit instruction not to
introduce new infrastructure ahead of a demonstrated need.
