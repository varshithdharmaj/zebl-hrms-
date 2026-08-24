# ZEBL AMS — day-wise documentation progress

This log tracks progress on **written documentation** under `docs/` (and the
progress-report PDF) from 6 August 2026 onward — what was authored, updated,
or clarified, independent of the underlying code changes. For code/feature
history see [`DAYWISE_DEVELOPMENT_LOG.md`](./DAYWISE_DEVELOPMENT_LOG.md).

## 6 August 2026

- Updated `ZEBL_AMS_Progress_Report_vs_Baseline.pdf` to reflect the day's recruitment-UX work (intake, offers, conversion, dashboard reports).
- Logged the day's commit hash into the day-wise development log.

## 7–9 August 2026 — No documentation changes

- No `docs/` files were touched on these dates; the writing that did happen (resume-parsing/hiring-decision notes folded into commit messages) landed as part of the 10 August checkpoint below.

## 10 August 2026 — Staging and rollout runbooks

- **Added `AWS_STAGING.md`** — first version of the AWS ECS Fargate staging environment guide (task definition, env vars, storage/DB notes).
- **Added `PILOT_ROLLOUT.md`** — a controlled-rollout runbook: go/no-go checklist before exposing real employees, staged rollout plan (developer/staging soak → wider pilot), rollback expectations, and on-call pointers.
- Updated the day-wise development log with the checkpoint's commit hashes.

## 11 August 2026 — No documentation changes

## 12 August 2026 — Load-test plan and staging pool guidance

- **Added `LOAD_TEST.md`** — an authenticated HTTP load-test plan: prerequisites (real staging DB, a real HR session cookie, not unauthenticated redirects), staged concurrency levels (2 → 100 sessions) with stop conditions, and the routes/metrics to watch.
- **Updated `AWS_STAGING.md`** — documented the new `DATABASE_POOL_MAX` environment variable in both the general env-var reference and the sample staging `.env` block, tying the doc to the same-day Prisma connection-pool cap fix.

## 13 August 2026 — Deployment troubleshooting expanded

- **Updated `DEPLOYMENT.md`** — added two new rows to the Vercel troubleshooting table: a runtime-crash symptom (`/login` loads but auth/API returns 500, "unexpected response from the server") with its likely causes (missing `AUTH_SECRET`, bad `DATABASE_URL`, startup config throw) and fix steps, and a note on preview URLs redirecting to Vercel's SSO gate when Deployment Protection is enabled.

## 14 August 2026 — Storage architecture documented

- **Added `STORAGE.md`** — documents the Phase 0A application file-storage architecture for recruitment documents and communication attachments: confirms the current deployment decision (AWS EC2, single instance, EBS-backed filesystem; no S3, no live eSSL DB integration, no payroll work in this phase), and notes the existing `StorageAdapter` boundary already supports an S3 driver for a future scaling phase without code changes.

## 15–19 August 2026 — No documentation changes

## 20–21 August 2026 — No documentation changes

- The biometric attendance bridge, public career-portal `/apply` flow, session idle-timeout policy, and 25th-to-25th attendance cycle shipped in this window without accompanying `docs/` updates.

## 22–24 August 2026 — Public-apply storage lifecycle (uncommitted / in progress)

- **Authored `PUBLIC_APPLY_STORAGE_CLEANUP.md`** — documents the temp-file lifecycle for public resume uploads under `storage/recruitment/public-intake/...`: what the system already handles automatically (copy-on-success into a permanent `CandidateDocument`, lazy expiry-on-access), the known V1 gap (an abandoned submission that's never revisited has no automatic cleanup trigger), how to safely identify a file/month-directory as an orphan safe to archive or delete, the recommended manual monthly operational process, and a deliberately-not-yet-built cleanup-cron design for if/when volume makes manual cleanup impractical.
- Extended the day-wise development log itself (this file's sibling) to cover 11–24 August, correcting an earlier bundled "7–10 August" heading into separate 7–9 (no-commit) and 10 August entries.
- Status: `PUBLIC_APPLY_STORAGE_CLEANUP.md` is new/untracked and the day-wise log edits are uncommitted, pending review/merge alongside the attendance-regularization and public-apply hardening code.

## Documentation still pending

- No dedicated doc yet for the new attendance-regularization feature (eligibility rules, overlay reconciliation logic, approval workflow) — currently only inline code comments and unit tests describe its behavior.
- No dedicated doc yet for the bot-check/notification hardening added to the public `/apply` flow beyond what's implied by `PUBLIC_APPLY_STORAGE_CLEANUP.md`'s scope note.

## Source notes

- Derived from `git log --name-status -- docs/` since 6 August 2026, plus the current uncommitted working tree.
- "No documentation changes" days are called out explicitly rather than omitted, so gaps in doc coverage are visible at a glance.
