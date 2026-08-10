# ZEBL AMS — day-wise development log

This log summarizes repository activity from Git history and the current working tree (through 10 August 2026). It describes delivered outcomes rather than every changed file.

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

## 7–10 August 2026 — Recruitment production checkpoint and staging prep

- Hardened deterministic resume parsing (Phase C / A+): PDF line reconstruction, section/pattern recall, merge-engine safety; experience precision 100% with zero PROJECT_AS_EXPERIENCE / P0 on the synthetic corpus. Phase B Gemini semantic verify remains off by default (`RESUME_SEMANTIC_VERIFY=0`).
- Added optional Gemini candidate enrichment and resume-field recovery (settings + API-key gated), with pending-insight uniqueness migrations.
- Shipped create-candidate-from-resume review flow and the hiring-decision vertical slice (eligibility, Prisma repo, service/actions/UI, offer gate, timeline/audit).
- Improved recruitment workflow continuity: context headers, breadcrumbs/return-to, pipeline/offer/conversion navigation, and shared loading skeletons across admin/employee shells.
- Added S3 recruitment storage driver, profile-avatar preview helpers, payroll summary read-path timing, and security headers / SSO auto-link default-off.
- Added AWS ECS Fargate staging artifacts (Dockerfile, task definition) and pilot rollout runbook.

Commits: `62dbddc`, `d460f1a`

## Current project state

- Core HR areas: attendance, employees, leave workflows, payroll-related attendance views, notifications, helpdesk, account management, and recruitment (hiring workspace).
- Security: role-based access, login history, active sessions, revocation, password changes, audit-oriented workflows, security dashboards, SSO auto-link opt-in only, and global security headers.
- Infrastructure: PostgreSQL/Supabase via Prisma, Vercel and Cloudflare/OpenNext deployment support, AWS ECS/S3 staging path, CI, CodeQL, Dependabot, and resumable attendance-import jobs.
- Attendance ingestion: daily Excel, daily PDF (including eSSL Daily Basic), eSSL Summary PDF, multi-date rows, optional preview, chunked jobs, and duplicate-skip reporting.
- Recruitment: jobs → candidates/resume import (deterministic A+) → applications/pipeline → hiring decision → interviews → offers → employee conversion, plus optional Gemini enrichment/recovery, communications, documents, analytics/reports, and workflow-continuity UX.
- Documentation: architecture, development setup, deployment, database/migrations, authentication, integrations, notifications, workflows, CI, attendance-import phases, recruitment PRD/architecture/schema/tech/blueprint, AWS staging, and pilot rollout.

## Source notes

- Dates and committed outcomes were derived from repository commits through 10 August 2026.
- This log should be updated when major work is merged.
