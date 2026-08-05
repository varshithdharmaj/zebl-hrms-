# ZEBL AMS — day-wise development log

This log summarizes repository activity from Git history and the current working tree. It describes delivered outcomes rather than every changed file.

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

## 29 July 2026 — Multi-format attendance import and CI automation

### Committed foundation

- Extended attendance upload support for Excel and PDF reports.
- Added report/date detection so single-day and multi-day uploads can resolve attendance dates correctly.
- Introduced per-row attendance dates while preserving the form-date fallback for daily reports.
- Refactored upload parsing and importing into shared attendance-import modules.
- Expanded parser, importer, PDF, and upload-action tests.

Commit: `b9e751f`

### Current working-tree work

- Added conservative report classification for `EXCEL_DAILY`, `PDF_DAILY`, `PDF_SUMMARY`, and unknown reports.
- Added single-pass structured PDF extraction while preserving the existing daily-PDF text path.
- Added an eSSL Summary PDF state-machine parser with per-row dates, repeated-header handling, employee sections, and totals skipping.
- Added parse-once preview/validation with batched employee and duplicate checks, confirm/cancel actions, and a 30-minute user-scoped cache.
- Made the preview workflow optional through `ENABLE_ATTENDANCE_IMPORT_PREVIEW`; direct import remains the default.
- Added upload metadata/date-detection panels and React hooks/actions for detection and preview.
- Added unit tests and anonymized fixtures for report detection, PDF extraction, Summary parsing, preview actions, feature flags, row dates, and upload UX.
- Added GitHub Actions CI for Prisma validation, typecheck, lint, tests, and production builds.
- Added CodeQL security scanning and weekly Dependabot updates.
- Added architecture, contribution, CI, and phase-by-phase attendance-import documentation.

Current status: these CI, attendance-import phase, test, and documentation files are present in the working tree but are not yet committed.

## Current project state

- Core HR areas: attendance, employees, leave workflows, payroll-related attendance views, notifications, helpdesk, and account management.
- Security: role-based access, login history, active sessions, revocation, password changes, audit-oriented workflows, and security dashboards.
- Infrastructure: PostgreSQL/Supabase via Prisma, Vercel and Cloudflare/OpenNext deployment support, CI, CodeQL, and Dependabot.
- Attendance ingestion: daily Excel, daily PDF, and known-layout eSSL Summary PDF support, including multi-date rows and optional preview.
- Documentation: architecture, development setup, deployment, database/migrations, authentication, integrations, notifications, workflows, CI, and attendance-import phases.

## Source notes

- Dates and committed outcomes were derived from repository commits through 29 July 2026.
- The 29 July “Current working-tree work” section was derived from uncommitted files currently visible to Git.
- This log should be updated when major work is merged; move working-tree items into the committed section after commit.
