# ZEBL AMS — day-wise development log

This log summarizes repository activity from Git history and the current working tree (through 24 August 2026). It describes delivered outcomes rather than every changed file.

## 24 May 2026 — Initial application and UI foundation

- Created the Next.js attendance-management application with Prisma, authentication, role-based dashboard layouts, and database seeding/migration utilities.
- Added core admin workflows for employees, attendance uploads, attendance records, leave balances, and leave management.
- Added employee attendance, dashboard, and leave views.
- Built the first shared UI system: navigation, forms, tables, cards, filters, status badges, charts, and responsive page layouts.
- Refined the admin and employee dashboards, attendance timelines, date-range filtering, and employee profile experience.

Commits: `072a1ac`, `5c9f939`, `f0e25f3`

## 31 May 2026 — Production hardening and PostgreSQL readiness

- Expanded the system architecture and engineering documentation for authentication, database setup, deployment, migrations, workflows, notifications, integrations, and ownership.
- Prepared PostgreSQL/Neon migrations, migration validation, data-transfer scripts, seed logic, background processors, and Docker-based local setup.
- Added production-oriented workflow, notification, integration, analytics, and approval-token foundations.
- Fixed Neon/Vercel migration ordering and seed behavior.
- Fixed login redirect loops, session-cookie clearing, TypeScript redirect narrowing, and dashboard React Server Component rendering.
- Reduced Prisma connection churn and hardened the admin dashboard against database and rendering failures.
- Added production error handling and deployment troubleshooting guidance.

Commits: `bb9de20`, `b0cc62d`, `e70f813`, `0e02744`, `f307491`, `c266723`, `1158eea`, `8c84e30`

## 16 July 2026 — Deployment preparation, upload compatibility, and password management

- Prepared application services and tests for production deployment.
- Improved top-bar and notification-center behavior and hardened authentication/notification queries.
- Added Excel attendance column aliases to accept more biometric export formats.
- Added automatic login creation when employees are created during attendance upload.
- Added change-password actions and settings UI for admin, manager, and employee roles.
- Added focused leave-calculation test coverage.

Commits: `5a973c7`, `cd0ad96`, `18bcc02`

## 20 July 2026 — Supabase migration and resilience/security controls

- Migrated the deployment target to Supabase PostgreSQL and documented the Cloudflare/Supabase stack.
- Strengthened database environment checks and connectivity diagnostics.
- Added DDoS/rate-limit protections and fail-tolerant behavior around actions and API routes.
- Added dashboard loading/error states and improved filtering, payroll, leave, and navigation UI.
- Added sidebar controls and general production resilience improvements.

Commit: `cfb6e63`

## 21 July 2026 — Helpdesk, account management, login history, and audit features

- Added the Helpdesk/ticketing domain, including employee and admin ticket workflows, anonymous tickets, comments, notifications, and audit support.
- Added login-history and active-session capabilities.
- Added account-management and user-administration workflows.
- Added dashboard audit and supporting admin/operations views.
- Expanded database models, migrations, actions, API routes, UI components, documentation, and tests for these features.
- Added Cloudflare/OpenNext deployment output during this checkpoint; generated artifacts were cleaned up later.

Commit: `79a7530`

## 22 July 2026 — Employee dashboard redesign

- Added a year-to-date attendance heatmap and selected-date KPI/hero experience.
- Added attendance-history preview and improved timeline/history navigation.
- Refined dashboard toolbar, widgets, statistics, charts, theme controls, and responsive styling.
- Documented the employee-dashboard baseline.
- Corrected heatmap code to satisfy lint rules.

Commits: `f0f8730`, `1dc0762`

## 23 July 2026 — Reproducible Cloudflare builds

- Made the Prisma WASM runtime preparation reproducible for Cloudflare/OpenNext builds.
- Updated ignore rules and removed generated OpenNext and Wrangler artifacts from version control.
- Removed a large accidentally tracked local Wrangler worker bundle and cache files.

Commits: `8aef306`, `dd47ce5`

## 24 July 2026 — Production deployment checkpoint

- Consolidated production-readiness work across Prisma, Cloudflare build scripts, authentication, employees, attendance upload, leave balances, tickets, security, and user management.
- Added/updated database migrations and strengthened environment, build, and browser-type generation scripts.
- Refined admin and employee pages, shared components, query/service boundaries, and error handling.
- Expanded unit and integration coverage and aligned lint/build configuration for deployment.

Commit: `a4a6d25`

## 28 July 2026 — Security hub, session management, and biometric import improvements

- Built admin and employee security hubs with security overview, current-device details, active-session lists, session revocation, and login-history filtering.
- Consolidated security pages into reusable components and improved sidebar/account navigation.
- Expanded login-history services and tests.
- Improved biometric Excel attendance parsing and alias handling.
- Added attendance fixtures/seed utilities and verification scripts for representative employee attendance periods.
- Added tests for session logout/revocation, security redirects/UI, login history, and biometric imports.

Commits: `0c8b168`, `ea60b47`

## 29 July 2026 — Multi-format attendance import foundation

- Extended attendance upload support for Excel and PDF reports.
- Added report/date detection so single-day and multi-day uploads can resolve attendance dates correctly.
- Introduced per-row attendance dates while preserving the form-date fallback for daily reports.
- Refactored upload parsing and importing into shared attendance-import modules.
- Expanded parser, importer, PDF, and upload-action tests.

Commit: `b9e751f`

## 31 July 2026 — Leave workflow, heatmap, and approval refinements

- Strengthened leave-workflow routing, step authorization, approver role labels, and pending-approval handling.
- Improved notification service behavior and approval-token consumption versioning.
- Refined the employee attendance heatmap UI/logic and day-label handling.
- Tightened manager assignment, account lifecycle, org helpers, and related unit tests.
- Updated workflow and architecture documentation.

Commits: `2310481`, `f37f61d`

## 1–2 August 2026 — No repository commits

- No Git commits recorded for these dates.

## 3 August 2026 — Attendance import productionization (PDF Daily, jobs, deploy fixes)

- Merged the previously in-progress attendance-import phases into `main`: report detection, structured PDF extraction, eSSL Summary parser, optional preview (`ENABLE_ATTENDANCE_IMPORT_PREVIEW`), upload UX panels, fixtures, and phase docs.
- Added GitHub Actions CI, CodeQL, Dependabot, and `docs/github-actions.md`.
- Added eSSL Daily Basic Report PDF import; auto-create employees on PDF import (parity with Excel); auto-detect attendance date from Daily PDF when present.
- Aligned local Upload Attendance UI with the production experience.
- Fixed large-PDF import transaction timeouts; added resumable chunked attendance-import jobs with runtime schema ensure.
- Targeted Supabase Postgres for the import-jobs schema path; run `prisma migrate deploy` on Vercel builds.
- Fixed Vercel 500s from missing Prisma query engine; Cloudflare next-build enums shim / upload-form restore; skip `DATABASE_URL` prebuild check on Cloudflare CI.
- Fixed `compressPayload` Buffer vs `Uint8Array` (ArrayBuffer-backed) for Prisma `Bytes`, with matching tests.
- Restored missing attendance-import modules required by `main`; accepted optional `previewEnabled` on `UploadForm` for deploy typecheck.

Commits: `bce30ae`, `b407546`, `aa7758c`, `7a9775a`, `731ae39`, `74ce967`, `013672d`, `5bf243b`, `b09b9d2`, `d9b08ff`, `73f75e9`, `833796b`, `2ec6e70`, `85ec57a`, `015473e`, `5d7a45c`

## 4 August 2026 — Import-job schema targeting and duplicate-skip UX

- Pointed attendance import jobs schema work at Supabase Postgres.
- Speed up duplicate skips during import and surface skipped employee codes in results/UX.

Commits: `02f1d6e`, `ccc3d36`

## 5 August 2026 — Recruitment module foundation

- Authored recruitment product/engineering docs: PRD, architecture, schema design, technical spec, and implementation blueprint.
- Added Prisma recruitment schema/migrations and demo seed/reset tooling for jobs, candidates, applications, interviews, offers, conversions, communications, documents, and analytics.
- Shipped admin recruitment routes and server actions for candidates, jobs, applications, interviews, offers, communications, documents, conversions, reports, and resume import.
- Added resume storage and import-review flow as the initial intake path.
- Bundled CI/CodeQL/Dependabot and attendance-import phase docs into this checkpoint where still outstanding.
- Added progress-report baseline PDF and day-wise development log.

Commit: `b94e9f6`

## 6 August 2026 — Recruitment UX deepening

- Expanded candidate intake UX: new-candidate flow, method chooser, resume upload panel, resume conflict dialog, parsing placeholder, and addable custom fields.
- Extended offer flows: revision panel, list filters/forms/PDF viewer refinements, offer PDF API route work, and revision/PDF tests.
- Advanced conversion handoff: preview/success dialogs, document transfer service, and conversion success route.
- Built dashboard/report surfaces: funnel counts, recruiter performance, time-to-hire metrics, report hub/filters, and sprint-3 smoke/dashboard tests.
- Hardened resume-import pipeline: file validation, merge engine, parser modules, and matching unit tests.
- Continued service/repository/action/schema updates across candidates, applications, interviews, offers, conversions, permissions, analytics, and audit.
- Updated progress-report PDF and package dependencies as needed for the above.

Commit: `63a2bde`

## 7–9 August 2026 — No repository commits (work landed in the 10 August checkpoint)

- No commits are dated 7, 8, or 9 August. Development during this window (deterministic resume-parsing hardening, Gemini enrichment, hiring-decision slice, workflow-continuity UX, AWS staging artifacts) was committed together on 10 August as `62dbddc` and `d460f1a` — see below.

## 10 August 2026 — Recruitment production checkpoint and staging prep

- Hardened deterministic resume parsing (Phase C / A+): PDF line reconstruction, section/pattern recall, merge-engine safety; experience precision 100% with zero PROJECT_AS_EXPERIENCE / P0 on the synthetic corpus. Phase B Gemini semantic verify remains off by default (`RESUME_SEMANTIC_VERIFY=0`).
- Added optional Gemini candidate enrichment and resume-field recovery (settings + API-key gated), with pending-insight uniqueness migrations.
- Shipped create-candidate-from-resume review flow and the hiring-decision vertical slice (eligibility, Prisma repo, service/actions/UI, offer gate, timeline/audit).
- Improved recruitment workflow continuity: context headers, breadcrumbs/return-to, pipeline/offer/conversion navigation, and shared loading skeletons across admin/employee shells.
- Added S3 recruitment storage driver, profile-avatar preview helpers, payroll summary read-path timing, and security headers / SSO auto-link default-off.
- Added AWS ECS Fargate staging artifacts (Dockerfile, task definition) and pilot rollout runbook.

Commits: `62dbddc`, `d460f1a`

## 11 August 2026 — Profile photos and recruitment-ops access

- Shipped a reusable `ProfileAvatar` component with local preview and a self-profile route so employees can upload/change their own photo.
- Added a scoped "recruitment test-manager" admin role with its own migration, middleware guards, and permission checks.
- Fixed tracking of a recruitment storage module that had been left out of version control.

Commits: `90c654c`, `73b4d66`

## 12–13 August 2026 — Production hardening: DB pooling, leave-ledger safety, forced password change, ops resilience

- Capped the Prisma/pg connection pool per ECS task (shared pool per process, `DATABASE_POOL_MAX`, drain on SIGTERM) to keep total connections under the RDS limit.
- Made leave-ledger writes idempotent under concurrent approval via partial unique indexes (one deduction, one cancel-restore per request; system accruals keyed by reason).
- Required local-account users to change a system-generated password before using the app; gated cron admin fallbacks the same way and required cron secrets in production.
- Fixed org-wide pending-approval KPIs to count only the current actionable step per request, matching the Approval Center; sped up the command-center stuck-request count.
- Aligned present/absent-day semantics across the heatmap and range aggregates; cached year-scoped attendance/holiday loads per request; capped the dashboard history preview at 7 rows.
- Scoped recruitment list queries and loaded the candidate workspace per-tab instead of fetching everything up front.
- Added route-level loading skeletons and pending-submit button feedback across the dashboard.
- Fixed a shared-Prisma-client test-teardown race; redacted secrets from logs; rejected `GET` on the integration cron endpoint; added a Docker ignore list and an authenticated staging load-test plan.
- Kept temporary perf/auth-verify bench scripts local (not shipped) and made the app boot even when optional cron secrets are missing, logging instead of throwing.

Commits: `f2a5a31`, `c223693`, `a716fc5`, `bbd73e6`, `0211745`, `7b29dfc`, `f61cc13`, `1206240`, `5ad073c`, `b6dcf0f`, `d2b80fd`, `9604794`

## 14 August 2026 — LLM resume parsing, manager role, AWS deployment scripts

- Implemented LLM-assisted resume parsing, a dedicated manager role, the recruitment candidate workspace, and supporting AWS deployment scripts.

Commit: `cfbf5c1`

## 20 August 2026 — Biometric bridge, dashboard resilience, application-form fixes

- Added the eSSL biometric attendance-bridge integration: a secret-gated cron endpoint ingests raw punch events and derives daily attendance records/sessions from punch history; included a one-off script to fix a timezone double-subtraction bug in early derived data.
- Paginated the admin employee list (25/page), added recovery from stale JS-chunk load errors, and fixed the attendance heatmap month highlight getting stuck after keyboard focus left the grid (plus click-to-pin a month).
- Fixed recruitment application create/update actions that passed raw `FormData` into Zod validation (causing `candidateId` to always fail); made long `Select` dropdowns scrollable.
- Guarded against null `FormData` values in password/login provisioning; restored test files to `tsconfig` and removed a redundant prisma-generate step from `predev`.

Commits: `81c8f0a`, `fe2912b`, `872b725`

## 21 August 2026 — Public career-portal apply flow, session policy, HR self-service workspace

- Shipped the public career-portal application flow (`/apply`): anonymous, unauthenticated candidates can apply from a shareable link — job publishing/slug assignment, the `/apply` intake API (start, basic-info, resume upload + deterministic parsing, review, submit), the `PublicApplicationSubmission` lifecycle model, and a shared `createApplicationCore()` so public and internal applications enter the pipeline identically.
- Added configurable session policy (idle timeout and max session hours) enforced via JWT expiry and an independent `LoginSession.lastActivityAt` check; password change now revokes all other sessions and re-establishes a fresh session for the current device instead of silently logging the user out.
- Exempted the anonymous `/apply` portal from role-home redirects and added HR/Super Admin "own workspace" access, so HR staff linked to an Employee record can use their own self-service dashboard/attendance/leaves/profile without gaining Manager-only access.
- Added a "My Workspace" sidebar group surfacing My Dashboard/Attendance/Leaves/Profile for HR/Super Admin users linked to an Employee record.
- Switched attendance dashboard date ranges (heatmap, timeline, filters) from calendar-month to the company's actual 25th-to-25th cycle, with new cycle-window styling and dark-theme/layout refinements.
- Removed a build-blocking `no-explicit-any` lint violation in the recruitment pipeline page's item mapping.
- Added one-off employee cleanup/maintenance scripts (identify and remove seeded/demo employees by code pattern, plus an audit script), and ignored local DB-snapshot backup exports so they can never be committed.

Commits: `caa4ce7`, `e72745f`, `1c1ce4e`, `466f1be`, `6e4a1d1`, `54a0998`, `f6dcdb5`

## 22–24 August 2026 — Attendance regularization and public-apply hardening (in progress / uncommitted)

- **Attendance regularization (new):** built an employee-facing request flow and an admin approval queue for correcting attendance (missed punch, wrong session, etc.) — eligibility checks, an "overlay" that reconciles a regularization against existing biometric sessions, a service layer that applies approved regularizations back into derived attendance, request/decision notifications, and audit logging. Added the admin queue UI, the employee panel, the admin route, a Zod schema module for regularization input, a Prisma migration, and unit tests covering derivation, overlay, service, and validation behavior.
- **Public apply hardening:** added lightweight bot protection for the `/apply` start endpoint (honeypot field + minimum-elapsed-time check, dependency-free so it's cheap to unit test), and queued candidate/HR notifications for the public application flow (candidate confirmation email, HR new-application alert) via the existing notification queue, sanitizing all candidate-supplied text before it reaches an email template.
- Added a Prisma migration for public-apply notification support.
- Authored `docs/PUBLIC_APPLY_STORAGE_CLEANUP.md`, documenting the temp-file lifecycle for public resume uploads: what's already handled automatically (copy-on-success, lazy expiry-on-access), the known V1 gap (abandoned submissions with no automatic cleanup), how to safely identify and archive/delete orphaned files, and a deliberately-not-built cleanup cron endpoint design for if/when volume requires it.
- Touched supporting files across public-apply services (origin guard, HTTP helpers, job query, application service), the employee-conversion service, employee actions, the audit log, and biometric ingestion/derivation to integrate the above.
- Status: not yet committed — changes are in the working tree pending review/merge.

## Current project state

- Core HR areas: attendance (including biometric bridge ingestion and regularization), employees, leave workflows, payroll-related attendance views, notifications, helpdesk, account management, and recruitment (hiring workspace + public career portal).
- Security: role-based access (incl. HR own-workspace and recruitment-ops scoped roles), login history, active sessions with idle/max-age policy, revocation, forced/self password changes, audit-oriented workflows, security dashboards, SSO auto-link opt-in only, and global security headers.
- Infrastructure: PostgreSQL/Supabase via Prisma with a pooled/capped connection strategy, Vercel and Cloudflare/OpenNext deployment support, AWS ECS/S3 staging path, CI, CodeQL, Dependabot, and resumable attendance-import jobs.
- Attendance ingestion: daily Excel, daily PDF (including eSSL Daily Basic), eSSL Summary PDF, eSSL biometric punch-event bridge (cron-derived daily records/sessions), multi-date rows, optional preview, chunked jobs, duplicate-skip reporting, and (in progress) employee-initiated regularization with admin approval.
- Recruitment: jobs → public career-portal apply (`/apply`, anonymous) or internal candidates/resume import (deterministic A+) → applications/pipeline → hiring decision → interviews → offers → employee conversion, plus optional Gemini enrichment/recovery, communications, documents, analytics/reports, and workflow-continuity UX.
- Documentation: architecture, development setup, deployment, database/migrations, authentication, integrations, notifications, workflows, CI, attendance-import phases, recruitment PRD/architecture/schema/tech/blueprint, AWS staging, pilot rollout, and public-apply storage cleanup.

## Source notes

- Dates and committed outcomes were derived from repository commits through 21 August 2026; the 22–24 August entry also reflects the current uncommitted working tree.
- This log should be updated when major work is merged.
