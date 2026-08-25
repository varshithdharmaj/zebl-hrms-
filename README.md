# ZEBL AMS

[![CI](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/ci.yml/badge.svg)](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/ci.yml)
[![CodeQL](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/codeql.yml/badge.svg)](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/codeql.yml)

ZEBL AMS is an internal HR platform covering **attendance, leave, helpdesk, security/audit, and recruitment**, built with Next.js 15 (App Router), Prisma, and PostgreSQL. This document is a developer handoff guide: what the system does today, how the pieces fit together, and how to set it up, test it, and ship it.

> This README describes what is actually implemented in the codebase as of this writing. Where a feature is partial, flagged off by default, or still a stub, that is called out explicitly — see [Current Product Status](#current-product-status).

## Table of Contents

- [Technology Stack](#technology-stack)
- [Core Modules](#core-modules)
- [Roles & Permissions](#roles--permissions)
- [Recruitment](#recruitment)
  - [Candidate Management](#candidate-management)
  - [Resume Parsing](#resume-parsing)
  - [Recruitment Pipeline](#recruitment-pipeline)
  - [Interview Management](#interview-management)
  - [Hiring Decision](#hiring-decision)
  - [Offers](#offers)
  - [Candidate Conversion](#candidate-conversion)
- [Employee Management](#employee-management)
- [Attendance](#attendance)
  - [Attendance Import](#attendance-import)
- [Leave Management](#leave-management)
- [Helpdesk](#helpdesk)
- [Authentication & Security](#authentication--security)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
  - [Docker PostgreSQL](#docker-postgresql)
- [Running Development Server](#running-development-server)
- [Production Build](#production-build)
- [Testing](#testing)
- [Recruitment Feature Flags](#recruitment-feature-flags)
- [Resume AI Configuration](#resume-ai-configuration)
- [File Storage](#file-storage)
- [Background Workers](#background-workers)
- [Health Checks](#health-checks)
- [Microsoft Entra ID](#microsoft-entra-id)
- [Microsoft Graph](#microsoft-graph)
- [Microsoft Teams](#microsoft-teams)
- [Email](#email)
- [AWS Deployment](#aws-deployment)
- [Vercel](#vercel)
- [Cloudflare](#cloudflare)
- [Database Performance](#database-performance)
- [Security Rules](#security-rules)
- [Development Workflow](#development-workflow)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Current Product Status](#current-product-status)

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui-style primitives, `class-variance-authority` |
| ORM / DB | Prisma 6 (`@prisma/adapter-pg`), PostgreSQL |
| Auth | `jose` (JWT sessions), `bcryptjs` (password hashing), `openid-client` (Microsoft Entra ID OAuth/PKCE) |
| Validation | Zod 4, organized under `src/lib/validation/schemas/` |
| Email | `nodemailer` + `@react-email/components` |
| Documents | `unpdf` (PDF text extraction), `mammoth` (DOCX), `xlsx` (Excel import) |
| Cloud storage (optional) | `@aws-sdk/client-s3` |
| Testing | Vitest (unit + integration) |
| Deploy targets | Vercel, AWS (Docker / ECS Fargate), Cloudflare Workers via `@opennextjs/cloudflare` |

## Core Modules

- **Attendance** — daily records, multi-session check-in/out, heatmaps, Excel/PDF biometric import.
- **Leave** — multi-step approval workflow, balance/accrual engine, email one-time approve links.
- **Recruitment** — job openings through hiring, interviews, offers, and conversion to employee (feature-flagged, off by default).
- **Helpdesk** — employee/admin support tickets with threaded comments and an audit trail.
- **Security & Audit** — RBAC, session revocation, login history, a centralized audit log.
- **Notifications** — an email/Teams notification queue drained by a background worker.
- **Integrations** — Microsoft Graph calendar sync, org sync, and Teams webhooks/callbacks.
- **Analytics** — workforce metrics and admin dashboards, computed by a background worker.

## Roles & Permissions

The `UserRole` enum (`prisma/schema.prisma`) has exactly four values:

| Role | Shell | Notes |
|---|---|---|
| `super_admin` | `/admin` | Full platform administration: user/role management, system config, audit log, anonymous ticket access. |
| `hr` | `/admin` | HR administration: employees, attendance, leave, recruitment, tickets — cannot manage other HR/Super Admin accounts or platform-level config. |
| `manager` | `/employee` | Employee self-service plus a "My Team" scope (`Employee.managerId` / `isLineManager`) for direct reports. |
| `employee` | `/employee` | Self-service: attendance, leave, tickets, profile. |

There are only **two route shells** — `(dashboard)/admin` and `(dashboard)/employee` — not one per role. `src/middleware.ts` enforces:

- `/admin/*` requires `hr` or `super_admin` (with a narrow carve-out for managers with `recruitmentOpsAccess` on `/admin/recruitment/*` — see below).
- `/employee/*` requires `employee` or `manager` (with a carve-out letting HR/Super Admin view their own linked self-service pages if they have an `employeeId`).
- Every request re-checks a session "version" against the DB and force-logs-out stale sessions (used for logout-everywhere and post-password-change revocation).

Authorization decisions are centralized as capability functions in `src/lib/permissions.ts` (e.g. `canAccessPlatformAdministration`, `canAccessHRAdministration`, `canManageUserRoles`, `canAdministerEmployeeAccount`) rather than scattered role string comparisons.

**Recruitment ops access for managers.** `User.recruitmentOpsAccess` is a separate, permanent boolean capability flag — independent of the four roles above — carried in the signed session JWT. A manager with this flag gets HR-admin-equivalent access to `/admin/recruitment/*` without being promoted to `hr`. HR and Super Admin always have recruitment access regardless of the flag. Changing the flag requires the user to re-login before it takes effect (JWT claim refresh).

## Recruitment

Recruitment is the largest module in the codebase (~200 files under `src/lib/recruitment/`) and is **feature-flagged off by default** — see [Recruitment Feature Flags](#recruitment-feature-flags). The workflow:

```text
Job Opening
    ↓
Candidate
    ↓
Application
    ↓
Pipeline Stage(s)
    ↓
Interview
    ↓
Hiring Decision
    ↓
Offer
    ↓
Acceptance
    ↓
Conversion
    ↓
Employee
```

These are distinct entities, not synonyms:

| Entity | What it represents |
|---|---|
| **Candidate** | A person profile — contact info, resume, experience, skills. Exists independently of any job; can apply to multiple jobs or sit in the talent pool. |
| **Application** | One candidate's application to one specific job opening. Carries pipeline status, current stage, assigned recruiter, and rejection/hold reasons. |
| **Pipeline stage** | Where an application currently sits in that job's hiring funnel (e.g. screening, technical round, offer). |
| **Hiring Decision** | An immutable, versioned recommendation (strong_hire / hire / borderline / hold / reject) recorded against an application — never mutated, only superseded by a new version. |
| **Offer** | A compensation offer tied to an application, with its own approval lifecycle (draft → manager approval → HR approval → released → accepted/declined/withdrawn). |
| **Conversion** | The one-time, transactional act of turning an accepted offer + candidate + application into a real `Employee` row, recorded as an immutable `EmployeeConversionSnapshot`. |
| **Employee** | The resulting HR record, used by the Attendance/Leave/Helpdesk modules from that point on. |

**The HR-curated candidate profile is the source of truth.** Resume-derived data (deterministic parsing, optional AI enrichment) only ever produces a *proposal* — HR reviews, edits, and accepts fields before they land on the `Candidate` record. Nothing from an automated extraction pipeline writes to the candidate profile unreviewed.

A key business rule enforced in `application-service.ts`: an application **cannot** be moved directly to `hired`. It must go through offer acceptance and Employee Conversion — moving straight to "hired" throws a domain error.

### Candidate Management

`Candidate` and its sub-records (`CandidatePersonal`, `CandidateExperience`, `CandidateEducation`, `CandidateSkill`, `CandidateProject`, `CandidateCertification`, `CandidateDocument`, `CandidateNote`) capture a full profile. Candidates can be tagged (`RecruitmentTag`/`CandidateTag`), merged (`mergedIntoCandidateId` self-relation for deduplication), placed in a `TalentPoolEntry`, or marked `do_not_hire`/`archived`. A public career-portal apply flow (`/apply/[slug]`) creates candidates from unauthenticated submissions (`PublicApplicationSubmission`, a tracked state machine from `started` through `submitted`).

### Resume Parsing

Implemented under `src/lib/recruitment/resume-import/`. Supports **PDF and DOCX only** (legacy `.doc` and scanned/image-only PDFs are not supported — OCR is explicitly out of scope).

- **Text extraction**: `unpdf` for PDF (with a positional-reconstruction fallback for PDFs with sparse line breaks), `mammoth` for DOCX.
- **Deterministic parsing (default, production path)**: regex/heuristic extraction of name, contact info, location, LinkedIn/GitHub/portfolio links, summary, work experience, education, skills, projects, and certifications.
- **Optional LLM full-parse mode** (`RESUME_PARSE_MODE=llm`): sends the original file to Gemini for structured extraction instead of the deterministic parser. Experimental — coexists as an alternative path for accuracy comparison, not a replacement.
- **Optional selective semantic verification** (`RESUME_SEMANTIC_VERIFY=1`, off by default): only for deterministic output flagged as ambiguous; asks Gemini to resolve specific fields, then merges the result back. On any AI failure, it safely falls back to the original deterministic draft.
- **Merge/normalization**: `normalizeParsedResumeDraft` standardizes extracted data into the same shape as the `Candidate` sub-models before presenting it to HR for review.
- The public unauthenticated `/apply` flow always forces deterministic parsing, regardless of the server-wide `RESUME_PARSE_MODE` setting, as a cost/trust boundary.
- **Benchmark**: `npm run bench:resumes` runs the deterministic (and optionally semantic-verification) pipeline against a synthetic resume corpus and reports field-level accuracy. It does not write to the application database.

Extraction accuracy is **not claimed to be 100%** — that's precisely why deterministic output is a reviewable proposal, why semantic verification exists as an opt-in refinement, and why the benchmark script exists to measure accuracy rather than assume it.

### Recruitment Pipeline

Each `JobOpening` has an ordered list of pipeline stages, seeded from a `RecruitmentPipelineTemplate`. Historically this was a fixed 15-value enum (`RecruitmentPipelineStage`: resume_received → screening → assessment → hr_round → technical_round → team_lead_round → manager_round → client_round → reference_check → decision → offer → hired / rejected / on_hold / withdrawn).

A recent, additive migration (`prisma/migrations/20260825090000_dynamic_pipeline_stages/`) introduces **per-job customizable pipeline stages** via a new `JobOpeningStage` table, with a coarse `StageCategory` (applied/screening/assessment/interview/decision/offer/joined/rejected) for funnel reporting independent of a job's custom stage labels. This is a backward-compatible, in-progress transition: both the legacy enum column and the new `JobOpeningStage` foreign key are written on every stage move, and `prisma/scripts/backfill-dynamic-pipeline-stages.ts` backfills existing data idempotently. Treat per-job custom stages as a newly-introduced capability, not a long-established one.

Every stage transition is recorded immutably in `ApplicationStageHistory`.

### Interview Management

`Interview` records support scheduling, meeting links, panelists (`InterviewPanelist`), and structured per-panelist feedback (`InterviewFeedback`: rating, recommendation, strengths, concerns, private notes). Interview status covers draft, scheduled, completed, no-show, and cancelled.

### Hiring Decision

`HiringDecision` is append-only and versioned (`version`, `isCurrent`) — submitting a new decision never edits a prior one. Outcomes are strong_hire / hire / borderline / hold / reject, each with a rationale, strengths/concerns, and a salary recommendation.

### Offers

`Offer` implements a full lifecycle: draft → manager approval → HR approval → released → accepted / declined / withdrawn, plus expiry and withdrawal. Offer terms (grade, joining date, CTC, salary breakdown, bonus, stock, probation, notice buyout) can be attached as a PDF, and every change is preserved as a versioned `OfferRevision` snapshot.

### Candidate Conversion

`employee-conversion-service.ts` provides a `previewConversion` dry run (shows the field mapping before committing) and `convertEmployee`, which transactionally creates the `Employee` row and an immutable `EmployeeConversionSnapshot` recording exactly which fields were mapped from where (`fieldMapVersion`, `mappedFields`). Candidate documents are copied into the new employee's document storage namespace at this point (`conversion-document-transfer.ts`).

## Employee Management

Once created (directly by HR, or via recruitment conversion), `Employee` records back the Attendance, Leave, Helpdesk, and manager-hierarchy (`managerId`) features. Admin employee management lives under `/admin/employees` and `/admin/user-management`.

## Attendance

`AttendanceRecord` holds one row per employee per day (daily totals: check-in/out, worked minutes, overtime, status). **Multiple check-in/check-out pairs per day are supported** via the child `AttendanceSession` table, while `AttendanceRecord` keeps the denormalized daily aggregate. Corrections go through `AttendanceRegularizationRequest` (employee-submitted, HR-reviewed) — raw punches are never mutated; approved regularizations are applied as an overlay by a derivation pipeline, and the previously-applied one is tracked via `AttendanceRecord.activeRegularizationId`.

An employee-dashboard **heatmap** (`src/components/employee/dashboard/attendance-heatmap.tsx`) shows monthly attendance with streaks and ratio-based color tiers.

### Attendance Import

Implemented under `src/lib/attendance/import/`:

- **Excel import** (`parse-excel.ts`) and **PDF import** — including eSSL Daily and eSSL Summary biometric report formats (`parse-pdf-daily-essl.ts`, `parse-pdf-summary.ts`), with automatic report-type detection.
- **Validation**: file size/row-count limits, format checks before any DB write.
- **Chunked, resumable processing**: `AttendanceImportJob` tracks `totalRows`, `nextRowIndex` (resume cursor), `importedCount`, `skippedCount`, `errorCount`, and stores parsed rows compressed (`payloadCompressed`) so an interrupted import can resume without re-uploading the file.
- **Duplicate handling**: import jobs track and report skipped/duplicate rows via job counters.
- **Preview mode** (optional, off by default): set `ENABLE_ATTENDANCE_IMPORT_PREVIEW=true` to require preview → confirm before writing; the default behavior is upload → import directly.
- Import jobs and their status are visible to admins under `/admin/upload` and `/admin/attendance`.

## Leave Management

The workflow engine (`src/lib/workflow/`) drives `LeaveRequest` through multi-step approval chains (`LeaveApprovalStep`), built dynamically per request. Key behaviors:

- **Balance deduction** happens only at final approval — Earned Leave (EL) uses a dedicated FIFO accrual/consumption engine (`ElAccrualLot`, `LeaveConsumption`); other leave types deduct directly from `EmployeeLeaveBalance`.
- **Rejection** requires a comment and marks remaining pending steps skipped.
- **Withdrawal** (by the requester, before any approver acts) vs. **Cancellation** (HR/admin-only, after approval, requires a reason, restores the balance) are distinct operations.
- **Concurrency safety**: optimistic version locking on the leave request and atomic per-step claiming prevent double-approval races.
- **Email one-time approve links**: `/approve/[token]` — a signed, single-use, rate-limited token (see [Security Rules](#security-rules)) lets an approver act from an email link without logging in.
- Every transition is written to the audit log in the same DB transaction.

## Helpdesk

`Ticket` / `TicketMessage` / `TicketHistory` implement employee and admin support tickets with threaded comments (internal vs. employee-visible via `TicketMessageVisibility`) and a full per-field change audit trail. Access is scoped: Super Admin sees everything including anonymous tickets; HR sees assigned + unassigned non-anonymous tickets; employees/managers see only their own. Pages live under `/employee/tickets` and `/admin/tickets` (including `/admin/tickets/anonymous`).

> Known gap: the anonymous-ticket toggle in the create-ticket action is currently hardcoded off in `src/actions/tickets.ts` — the anonymous ticket *viewing* permissions exist, but the UI path to submit one anonymously is not fully wired up.

## Authentication & Security

See [Security Rules](#security-rules) below for the consolidated list. In short: JWT sessions (`jose`), bcrypt password hashing, DB-backed session-version revocation, optional Microsoft Entra ID SSO (PKCE), a centralized audit log, HMAC-signed one-time approval tokens, and Bearer-secret-protected worker/cron endpoints.

## Project Structure

```text
src/
├── app/                     # Routes
│   ├── (dashboard)/admin/   # HR / Super Admin shell
│   ├── (dashboard)/employee/# Employee / Manager shell
│   ├── api/                 # Route handlers (auth, health, recruitment, workers, ...)
│   ├── apply/[slug]/        # Public recruitment career portal
│   ├── approve/[token]/     # One-time email approval links
│   └── login/, change-password/
├── actions/                 # Server actions (mutations)
├── components/              # UI, organized by role/domain (incl. recruitment/)
└── lib/
    ├── auth/                # Local + Microsoft SSO providers, session, guards
    ├── data/                # Centralized read models
    ├── validation/schemas/  # Zod schemas
    ├── errors/               # AppError + API handlers
    ├── workflow/             # Leave approval engine
    ├── attendance/            # Attendance domain incl. import/, heatmap, regularization
    ├── recruitment/           # Hiring domain: job/, candidate/, application/, interview/,
    │                          # offer/, conversion/, resume-import/, ai/, storage/, services/
    ├── microsoft/             # Graph (calendar, org sync, Teams)
    ├── notifications/, integrations/, analytics/, tickets/, approval-tokens/
    └── audit.ts, permissions.ts, roles.ts, session.ts, middleware helpers

prisma/
├── schema.prisma
├── migrations/               # Postgres migrations (source of truth)
├── migrations_sqlite_archive/# Historical, no longer applied
├── recruitment-demo/, demo-seed.ts, demo-reset.ts, seed.ts
└── scripts/                  # DB env checks, phase migrations, workers, maintenance scripts

tests/
├── fixtures/, helpers/
├── unit/                     # 213 tests — no DB required
└── integration/               # 7 tests — require a live PostgreSQL DATABASE_URL
```

## Prerequisites

- **Node.js 22+** (matches CI and the production Docker image)
- npm
- PostgreSQL 16 (local Docker, Supabase, Neon, or RDS — see [Database Setup](#database-setup))

## Local Setup

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL, AUTH_SECRET at minimum — never commit .env
npm run db:check-env         # validates required env vars are present
npm run db:ping              # verifies PostgreSQL connectivity
npm run db:generate          # prisma generate + browser-types patch
npx prisma migrate deploy    # apply all migrations
npm run db:seed              # creates the seed admin user + reference data
npm run dev                  # http://localhost:3000
```

`npm run dev` already runs `db:check-env` and `db:ping` automatically via its `predev` hook.

**Default seeded admin login** (change immediately in any shared environment): `hr@zebl.com` / `Hr@2026` — see `prisma/seed.ts`.

Optional demo data:

```bash
npm run demo:seed     # general demo seed
npm run seed:demo     # recruitment-specific demo seed
```

## Environment Variables

Copy [.env.example](.env.example) to `.env`. **Never commit `.env` or real secrets.**

**Required**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | JWT session signing key |

**Authentication**

| Variable | Purpose |
|---|---|
| `INITIAL_SUPER_ADMIN_EMAIL` / `INITIAL_SUPER_ADMIN_PASSWORD` | Optional; used by `npm run db:bootstrap-admin` (idempotent, never assigned via SSO) |
| `TEST_MANAGER_PASSWORD` / `ALLOW_TEST_MANAGER_SEED` | Optional test line-manager accounts (`npm run db:seed:test-managers`); production requires both explicitly set |
| `APP_BASE_URL` | Public URL used in emails/OAuth redirects; optional on Vercel (`VERCEL_URL` used automatically) |

**Database**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled/app connection |
| `DIRECT_URL` | Direct (non-pooled) connection, used for migrations |
| `DATABASE_POOL_MAX` | Optional; connections per process (default 5, max 20) |

**Email**

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Optional; enables outbound notification/approval emails |

**Workers**

| Variable | Purpose |
|---|---|
| `NOTIFICATION_CRON_SECRET`, `INTEGRATION_CRON_SECRET`, `ANALYTICS_CRON_SECRET` | Required in production; Bearer secrets protecting the `/api/*/process` worker HTTP endpoints |

**Microsoft Entra ID**

| Variable | Purpose |
|---|---|
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | Required together to enable SSO |
| `AZURE_AD_REDIRECT_URI` | OAuth callback URL |
| `AUTH_SSO_AUTO_LINK` | Opt-in; auto-link an Entra sign-in to an existing local user by email. Default `false` — keep it that way unless you accept the email-linking risk |
| `AUTH_SSO_AUTO_PROVISION` | Opt-in; auto-create a `User` from SSO for an unprovisioned but known `Employee` email |
| `AZURE_AD_GROUP_ROLE_MAP`, `AZURE_AD_APP_ROLE_MAP` | Optional JSON maps from Azure group/app-role claims to AMS roles (only for newly auto-provisioned users; can never resolve to `super_admin`) |

**Microsoft Graph**

| Variable | Purpose |
|---|---|
| `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` | Calendar sync and org sync (separate app registration from Entra SSO) |

**Teams**

| Variable | Purpose |
|---|---|
| `TEAMS_WEBHOOK_URL` | Outbound Adaptive Card notifications (leave approvals) |
| `TEAMS_CALLBACK_SECRET` | HMAC-verifies inbound Teams Approve/Reject callback signatures |
| `CALENDAR_TIMEZONE` | Timezone used for calendar sync display |

**Attendance**

| Variable | Purpose |
|---|---|
| `ENABLE_ATTENDANCE_IMPORT_PREVIEW` | Optional; enables preview-before-confirm import UI (default: off — direct import) |

**Recruitment**

| Variable | Purpose |
|---|---|
| `RECRUITMENT_MODULE_ENABLED` | Master switch — off by default; gates both the `/admin/recruitment` UI and every recruitment service call server-side |
| `RECRUITMENT_OFFERS_ENABLED`, `RECRUITMENT_CONVERSION_ENABLED` | Sub-flags; default on once the module is enabled |

**Recruitment storage**

| Variable | Purpose |
|---|---|
| `RECRUITMENT_STORAGE_DRIVER` | `local` (default; dev and current AWS deployment) or `s3` (implemented, not currently used in production) |
| `RECRUITMENT_STORAGE_ROOT` | Local driver root path — must be outside the app deploy directory in production |
| `RECRUITMENT_S3_BUCKET`, `RECRUITMENT_S3_REGION`, `RECRUITMENT_S3_PREFIX`, `RECRUITMENT_S3_ENDPOINT`, `RECRUITMENT_S3_FORCE_PATH_STYLE` | Only used when `RECRUITMENT_STORAGE_DRIVER=s3` |

**Gemini (resume AI)**

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional; resume import works fully without it (deterministic parsing) |
| `RESUME_PARSE_MODE` | `deterministic` (default) or `llm` (experimental, requires `GEMINI_API_KEY`) |
| `RESUME_SEMANTIC_VERIFY` | `1` to enable selective AI verification of ambiguous fields; keep `0`/unset in production |

**Approval tokens**

| Variable | Purpose |
|---|---|
| `APPROVAL_TOKEN_SECRET` | Signs `/approve/[token]` links; falls back to `AUTH_SECRET` if unset |
| `APPROVAL_TOKEN_TTL_HOURS` | Token expiry window (default 72h) |

## Database Setup

```bash
npm run db:ping           # connectivity check
npm run db:generate       # prisma generate + client patch
npx prisma migrate deploy # apply committed migrations — use this, not db push, in any shared/production environment
npm run db:seed           # seed admin user + reference data
npm run db:validate       # tsx prisma/scripts/validate-migrations.ts
npx prisma studio          # optional GUI browser for the database
```

Use `npx prisma migrate deploy` for every shared environment (staging, production). `npm run db:push` (`prisma db push`) exists for fast local iteration only — it does not create a migration history and should not be used as a production migration strategy. `npm run db:setup` is a convenience wrapper (`prisma migrate deploy && db:seed`); `npm run db:setup:legacy` replays an older phased-migration + seed sequence and exists for historical environments only.

Docs for specific providers: [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) (troubleshooting), [docs/NEON_SETUP.md](docs/NEON_SETUP.md), [docs/CLOUDFLARE_SUPABASE_STACK.md](docs/CLOUDFLARE_SUPABASE_STACK.md), [docs/POSTGRES_WINDOWS_SETUP.md](docs/POSTGRES_WINDOWS_SETUP.md), [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

### Docker PostgreSQL

```bash
npm run db:postgres:up    # docker compose up -d — postgres:16-alpine on localhost:5432
```

Credentials and database name are set in [docker-compose.yml](docker-compose.yml) (`zebl` / `zebl_dev_password` / `zebl_ams`) — for local development only.

## Running Development Server

```bash
npm run dev
```

Runs `next dev -H 0.0.0.0` (bound to all interfaces), after automatically checking env vars and DB connectivity.

## Production Build

```bash
npm run build   # prisma generate + browser-types patch + next build
npm run start   # next start
```

`npm run build` runs a `prebuild` env check first (`db:check-env`) — a valid `DATABASE_URL` shape must be present even for a build-time placeholder (see the Docker build stage, which sets a dummy `DATABASE_URL`/`AUTH_SECRET` to satisfy this check).

## Testing

```bash
npm test              # vitest run — 213 unit tests, no database required
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
npm run typecheck:tests
npm run lint
npm run validate      # typecheck + lint + test
```

Integration tests (`tests/integration/`, 7 tests) require a live `DATABASE_URL=postgresql://...` and a migrated/seeded database (`npm run db:setup`) — they are not run by default with `npm test` unless a real database is configured, since they hit Postgres directly (e.g. concurrency tests for leave approval).

## Recruitment Feature Flags

| Flag | Default | Effect |
|---|---|---|
| `RECRUITMENT_MODULE_ENABLED` | `false` | Master switch. When off, `/admin/recruitment` is unreachable and every recruitment service call is rejected server-side (`RecruitmentPermissionService.requireModuleEnabled()`), not just hidden in the UI. |
| `RECRUITMENT_OFFERS_ENABLED` | on (once module enabled) | Set `false` to disable the Offers sub-feature independently. |
| `RECRUITMENT_CONVERSION_ENABLED` | on (once module enabled) | Set `false` to disable Employee Conversion independently. |

## Resume AI Configuration

See [Resume Parsing](#resume-parsing) for behavior. Configuration knobs: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `RESUME_PARSE_MODE`, `RESUME_SEMANTIC_VERIFY`. AI features are additionally gated by the `RecruitmentSettings.aiEnabled` database flag (default `true`) — both the env var and the DB flag must allow it. With no `GEMINI_API_KEY` set, resume import still works end-to-end via the deterministic parser.

## File Storage

Recruitment documents and communication attachments go through a `StorageAdapter` abstraction (`src/lib/recruitment/storage/`) — application code never touches the filesystem directly, only logical keys. Two real drivers exist:

| Driver | Adapter | Use |
|---|---|---|
| `local` (default) | `local-storage-adapter.ts` | Development **and** the current AWS deployment |
| `s3` | `s3-storage-adapter.ts` | Implemented for future multi-instance scaling; **not used in the current production deployment** |

In production with the local driver, set `RECRUITMENT_STORAGE_ROOT` to a path outside the app's deploy directory (e.g. `/data/zebl/storage/recruitment`) so a redeploy never wipes uploaded files. See [docs/STORAGE.md](docs/STORAGE.md) for the full architecture, including the path-traversal guard (`assertSafeKey`) and the authorization chain (session → scope engine → DB row → storage key).

> Attachment virus scanning (`scanAttachmentForVirus()`) is currently a documented no-op stub — no antivirus service is wired in.

## Background Workers

| Command | Purpose |
|---|---|
| `npm run notifications:process` | Drains the email/Teams notification queue |
| `npm run integrations:process` | Calendar sync, org sync, escalation scan |
| `npm run analytics:process` | Computes analytics snapshots |

Each also has an HTTP trigger, protected by its respective cron secret as a Bearer token:

- `POST /api/notifications/process`
- `POST /api/integrations/process`
- `POST /api/analytics/process`

Schedule these on whatever the deployment platform provides — EventBridge Scheduler → ALB (AWS), Vercel Cron, or a CLI cron job hitting the HTTP endpoints. Worker health is recorded in `WorkerHeartbeat` and surfaced at `/admin/operations` and `GET /api/health/deep`.

## Health Checks

| Endpoint | Auth | Checks |
|---|---|---|
| `GET /api/health` | None | Database connectivity only (`SELECT 1`) — for load balancer / liveness probes |
| `GET /api/health/deep` | Cron secret or admin session | Database, application config, notification/integration queue depth (including stuck jobs), worker heartbeat freshness, SMTP config presence, Teams webhook config |

## Microsoft Entra ID

Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, and `AZURE_AD_REDIRECT_URI` to enable **PKCE-based OAuth 2.0** sign-in (`openid-client`) at `/api/auth/microsoft` → `/api/auth/microsoft/callback`. The tenant claim is validated against the configured tenant; PKCE verifier/state/nonce are held in a short-lived signed cookie, not server-side session storage.

- New Entra sign-ins are rejected by default unless `AUTH_SSO_AUTO_PROVISION=true` (and a matching `Employee` with no `User` yet exists) or `AUTH_SSO_AUTO_LINK=true` (matches an existing local `User` by email).
- `AZURE_AD_GROUP_ROLE_MAP` / `AZURE_AD_APP_ROLE_MAP` can assign a starting role to newly auto-provisioned users only — an existing user's AMS role always takes priority over any SSO claim, and a mapping can never resolve to `super_admin`.
- SSO account linking/provisioning events are written to the audit log.

See [docs/AUTH.md](docs/AUTH.md) — note its role table (`admin`/`manager`/`employee`) is out of date; the actual roles are `super_admin`, `hr`, `manager`, `employee` as documented above.

## Microsoft Graph

`GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` (a separate app registration from the Entra SSO one) power calendar sync (`src/lib/calendar/`, `src/lib/microsoft/graph-calendar.ts`) and organization/directory sync (`src/lib/microsoft/org-sync.ts`). See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Microsoft Teams

1. Create an Incoming Webhook in a Teams channel and set `TEAMS_WEBHOOK_URL` (env or **Admin → Integrations**).
2. Set `TEAMS_CALLBACK_SECRET` to verify inbound Approve/Reject card actions at `/api/integrations/teams/callback` (HMAC-signed, rate-limited to 30 requests/10 min per IP).
3. Approve/Reject actions taken from a Teams card consume the same one-time approval-token system used by email links.
4. Ensure `notifications:process` runs on a schedule to actually deliver queued Teams messages.

## Email

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` to enable outbound email (notifications, leave approval links). Sent via `nodemailer`; templates via `@react-email/components`. If SMTP is unset, `GET /api/health/deep` reports a warning but the app still runs — email notifications simply queue without being delivered.

## AWS Deployment

**Current production storage/deployment decision** (per [docs/STORAGE.md](docs/STORAGE.md)): a single AWS EC2 instance with persistent EBS-backed filesystem storage (`RECRUITMENT_STORAGE_DRIVER=local`) — no S3, no live eSSL DB integration, no payroll integration in this phase.

The [Dockerfile](Dockerfile) builds a production image (Node 22 Bookworm, multi-stage, non-root user, `/api/health` container healthcheck) intended for **ECS Fargate / App Runner**. A target architecture for scaling to 150–200 concurrent users — ECS Fargate behind an ALB, RDS PostgreSQL, S3 for recruitment storage, SES for email, EventBridge-scheduled workers, Secrets Manager, CloudWatch — is documented in [docs/AWS_STAGING.md](docs/AWS_STAGING.md) with a matching task definition at [deploy/ecs/task-definition.staging.json](deploy/ecs/task-definition.staging.json). Treat this as the staging/scale-out target, not necessarily what a single-instance EC2 deployment is running today — confirm which is live with your infrastructure owner before assuming either one.

`deploy/zebl_ams_aws_schema.sql` is a PostgreSQL 16 schema dump, kept as a reference/restore snapshot.

## Vercel

The simplest deployment path — documented end-to-end in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) using Vercel + Neon PostgreSQL (both free-tier capable, no Docker/VPS/custom domain required). `vercel.json` sets baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`). Required env vars: `DATABASE_URL`, `AUTH_SECRET`; recommended: `APP_BASE_URL` (falls back to `VERCEL_URL`).

## Cloudflare

Supported via `@opennextjs/cloudflare`:

```bash
npm run cf:build    # opennextjs-cloudflare build + WASM prep
npm run cf:deploy   # cf:build && wrangler deploy
```

Configured in [wrangler.jsonc](wrangler.jsonc) and [open-next.config.ts](open-next.config.ts). Framed in [docs/CLOUDFLARE_SUPABASE_STACK.md](docs/CLOUDFLARE_SUPABASE_STACK.md) as a cost-driven alternative stack (Cloudflare Workers + Supabase Postgres) compared against Vercel + Neon, not as the confirmed production path.

## Database Performance

- Keep `DATABASE_POOL_MAX` × (number of app instances/tasks) below your PostgreSQL provider's `max_connections`.
- Use the pooled connection string (`DATABASE_URL`, e.g. Supabase's port-6543 pooler or RDS Proxy/PgBouncer) for the app; use the direct connection (`DIRECT_URL`) for `prisma migrate`.
- See [docs/POSTGRESQL_READINESS.md](docs/POSTGRESQL_READINESS.md), [docs/POSTGRES_MIGRATION_READINESS.md](docs/POSTGRES_MIGRATION_READINESS.md), and [docs/LOAD_TEST.md](docs/LOAD_TEST.md).

## Security Rules

- **JWT sessions** — signed with `AUTH_SECRET` (HS256, via `jose`); the cookie carries role, employee link, and the `recruitmentOpsAccess` capability.
- **Password hashing** — `bcryptjs`; never store plaintext passwords.
- **RBAC** — four roles (`super_admin`, `hr`, `manager`, `employee`) enforced both in `src/middleware.ts` (route-level) and centrally in `src/lib/permissions.ts` (action-level). Do not scatter new role checks elsewhere.
- **Session revocation** — a DB-tracked session version is checked on every request; changing a user's role or password invalidates their existing sessions.
- **Audit logs** — a centralized `AuditLog` model + `writeAuditLog()` helper covers auth, employee/role admin, leave workflow, tickets, approval tokens, calendar sync, Teams, org sync, and more. Reviewable at `/admin/audit`.
- **Zod validation** — all mutation inputs are validated against schemas in `src/lib/validation/schemas/` before touching the database.
- **Approval token security** — `/approve/[token]` links are HMAC-signed (`APPROVAL_TOKEN_SECRET`, falling back to `AUTH_SECRET`); only the token's hash is stored in the database, so a database leak alone cannot forge an approval. Tokens are single-use, expire (`APPROVAL_TOKEN_TTL_HOURS`, default 72h), and are revoked in pairs when a leave request's state changes.
- **Cron/worker secrets** — `NOTIFICATION_CRON_SECRET`, `INTEGRATION_CRON_SECRET`, `ANALYTICS_CRON_SECRET` gate the `/api/*/process` and `GET /api/health/deep` endpoints as Bearer tokens; required in production.
- **SSO safety rails** — `AUTH_SSO_AUTO_LINK`/`AUTH_SSO_AUTO_PROVISION` default to `false`; SSO role mapping can never assign `super_admin`.
- **Never commit `.env`** or any file containing real `DATABASE_URL`, `AUTH_SECRET`, SMTP, Azure, Teams, or Gemini credentials. `.env.example` documents the shape only.

## Development Workflow

```bash
npm install
npm run db:postgres:up   # optional local Postgres
npm run db:setup         # migrate deploy + seed
npm run dev
```

Code conventions:

| Concern | Location |
|---|---|
| Read queries | `src/lib/data/` |
| Validation | `src/lib/validation/schemas/` (Zod) |
| Mutations | `src/actions/` |
| API error handling | `AppError`, `withAuthenticatedApi` |
| UI primitives | `src/components/ui/` |
| Design tokens | `src/lib/design/tokens.ts` |

PRs targeting `main` must pass GitHub Actions CI (typecheck → lint → test → build) — see [.github/workflows/ci.yml](.github/workflows/ci.yml) and [docs/github-actions.md](docs/github-actions.md). Full contributor guide: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Useful Commands

| Command | Purpose |
|---|---|
| `npm run db:list-manager-candidates` / `npm run db:apply-manager-role` | Find and grant `recruitmentOpsAccess` to line managers |
| `npm run db:bootstrap-admin` | Idempotently create the initial Super Admin from env vars |
| `npm run db:seed:test-managers` | Seed test manager accounts with partitioned direct reports |
| `npm run db:ensure-import-jobs` | Hand-apply the `attendance_import_jobs` table when a pooled connection can't reach `DIRECT_URL` |
| `npm run db:backfill-dynamic-pipeline-stages` | Backfill `JobOpeningStage` / stage-history FKs for the dynamic pipeline stages migration |
| `npm run db:migrate-postgres-check` | Validates PostgreSQL connectivity and expected tables exist |
| `npx prisma studio` | Browse the database with a GUI |

## Troubleshooting

**Database**

- *`DATABASE_URL` missing* — `npm run db:check-env` fails fast with a clear message; `dev`/`build` both run this automatically via `predev`/`prebuild`.
- *Database unreachable* — run `npm run db:ping` directly to isolate the issue from the app; check that you're using the pooled URL for the app and the direct URL for migrations.
- *Prisma client mismatch* (stale generated types) — run `npm run db:generate`.
- *Migration mismatch* — run `npm run db:validate` (`prisma/scripts/validate-migrations.ts`); never edit an already-applied migration file, create a new one.

**Authentication**

- *Invalid `AUTH_SECRET`* — sessions fail to verify after a secret rotation; all existing sessions are invalidated (expected) — users must log in again.
- *SSO callback mismatch* — confirm `AZURE_AD_REDIRECT_URI` exactly matches the redirect URI registered in the Entra app registration, including protocol and trailing slashes.
- *Stale JWT after permission changes* — expected: the session-version check catches this on the next request and forces re-login, but a user mid-session may see a redirect to login rather than an instant permission change.

**Resume Parsing**

- *Unsupported format* — only PDF and DOCX are supported; legacy `.doc` and scanned/image-only PDFs will not extract text (OCR is out of scope).
- *Malformed PDF* — the extractor falls back to positional text reconstruction; if that still yields too little text, expect an empty/partial draft rather than a crash.
- *Missing sections* — deterministic parsing is heuristic; sparse resumes will produce sparse drafts. HR review is expected, not optional.
- *Gemini unavailable* — both the optional LLM parse mode and semantic verification fail safe: they fall back to (or simply skip and keep) the deterministic draft. Resume import as a whole does not fail if Gemini is down or `GEMINI_API_KEY` is unset.

**Deployment**

- *Missing production environment variables* — `predev`/`prebuild` env checks catch the obvious ones locally; in production, hit `GET /api/health/deep` (with a cron secret) to see config warnings (SMTP, Teams) surfaced explicitly.
- *Missing database migrations* — always run `npx prisma migrate deploy` as part of deploy, never rely on `db push` in production.
- *Persistent storage path problems* (local storage driver) — confirm `RECRUITMENT_STORAGE_ROOT` points outside the app's deploy directory; a code deploy that overwrites the app directory will otherwise wipe uploaded recruitment files.
- *Database region latency* — prefer a database region co-located with your app's region/AZ; see [docs/LOAD_TEST.md](docs/LOAD_TEST.md).

## Documentation

**Core**

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview and layers
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — developer setup and conventions
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — leave workflow engine
- [docs/AUTH.md](docs/AUTH.md) — sessions, roles, SSO (role table is stale — see [Roles & Permissions](#roles--permissions))
- [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) — queue and channels
- [docs/DATABASE.md](docs/DATABASE.md) — schema and query conventions
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Graph, Teams, calendar
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — operational fixes
- [docs/CODE_OWNERSHIP.md](docs/CODE_OWNERSHIP.md) — module boundaries
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — migration order and rules
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + Neon runbook
- [docs/AWS_STAGING.md](docs/AWS_STAGING.md) — AWS ECS/RDS/S3 target architecture
- [docs/CLOUDFLARE_SUPABASE_STACK.md](docs/CLOUDFLARE_SUPABASE_STACK.md) — Cloudflare / Supabase stack
- [docs/STORAGE.md](docs/STORAGE.md) — recruitment file storage architecture
- [docs/github-actions.md](docs/github-actions.md) — CI, CodeQL, Dependabot
- [docs/DAYWISE_DEVELOPMENT_LOG.md](docs/DAYWISE_DEVELOPMENT_LOG.md) — day-wise delivered outcomes

**Recruitment**

- [docs/RECRUITMENT_PRD.md](docs/RECRUITMENT_PRD.md)
- [docs/RECRUITMENT_ARCHITECTURE.md](docs/RECRUITMENT_ARCHITECTURE.md)
- [docs/RECRUITMENT_SCHEMA_DESIGN.md](docs/RECRUITMENT_SCHEMA_DESIGN.md)
- [docs/RECRUITMENT_TECHNICAL_SPEC.md](docs/RECRUITMENT_TECHNICAL_SPEC.md)
- [docs/RECRUITMENT_IMPLEMENTATION_BLUEPRINT.md](docs/RECRUITMENT_IMPLEMENTATION_BLUEPRINT.md)

> These recruitment docs are planning/spec documents and may describe scope beyond what's shipped — this README's [Recruitment](#recruitment) section reflects the current implementation; treat divergences in favor of the code and this README.

**Attendance import**

- [docs/attendance-import-phase1.md](docs/attendance-import-phase1.md) through [phase5b.md](docs/attendance-import-phase5b.md) — chronological build log, culminating in the current chunked/resumable import with optional preview

**Helpdesk**

- [docs/HELPDESK_PRODUCTION_REVIEW.md](docs/HELPDESK_PRODUCTION_REVIEW.md), [docs/ticket-audit-implementation.md](docs/ticket-audit-implementation.md), [docs/ticket-notifications-implementation.md](docs/ticket-notifications-implementation.md)

## Current Product Status

### Implemented

- Attendance: daily records, multi-session check-in/out, regularization workflow, heatmap, Excel/PDF (eSSL Daily & Summary) import with chunked resumable processing and duplicate/skip reporting.
- Leave: multi-step approval workflow, EL FIFO accrual, balance restoration on cancellation, email one-time approve links, Teams approve/reject callbacks.
- Helpdesk: tickets, threaded comments with internal/external visibility, full change audit trail.
- Recruitment: job openings, candidate profiles, applications, interviews, versioned hiring decisions, offer lifecycle, transactional employee conversion, resume parsing (deterministic, PDF/DOCX), local file storage.
- Auth: local login + optional Microsoft Entra ID SSO (PKCE), four-role RBAC, session revocation, audit logging, approval-token security.
- Background workers: notifications, integrations (calendar/org sync/escalation), analytics — both CLI and HTTP-triggered.
- Health checks (shallow + deep) and `/admin/operations` worker visibility.
- 213 unit tests + 7 integration tests, CI-gated (typecheck, lint, test, build) on every PR to `main`.

### Optional (implemented, off or unconfigured by default)

- Recruitment module as a whole (`RECRUITMENT_MODULE_ENABLED=false` by default).
- Attendance import preview-before-confirm mode (`ENABLE_ATTENDANCE_IMPORT_PREVIEW`).
- Resume LLM full-parse mode and selective semantic verification (`RESUME_PARSE_MODE=llm`, `RESUME_SEMANTIC_VERIFY`) — require `GEMINI_API_KEY`; deterministic parsing works without either.
- Microsoft Entra SSO, Graph calendar/org sync, Teams notifications — all require their respective credentials to activate.
- S3 recruitment storage driver (`RECRUITMENT_STORAGE_DRIVER=s3`) — implemented but unused in the current production deployment, which uses local filesystem storage.

### Future / Planned

- Per-job dynamic pipeline stages (`JobOpeningStage`) are mid-migration: additive and backward-compatible, with both the legacy fixed-enum stage and the new per-job stage written simultaneously. Full cutover to per-job-only stages has not happened.
- A dedicated `src/lib/recruitment/dashboard/` module is a documented placeholder (`export {}`) — recruitment dashboard metrics currently live inline in individual service files instead.
- Recruitment attachment virus scanning (`scanAttachmentForVirus()`) is a documented no-op — no antivirus integration exists yet.
- Anonymous ticket submission from the employee-facing create-ticket action is currently hardcoded off, even though the viewing/permission model for anonymous tickets exists.
- AWS ECS Fargate + RDS + S3 (per [docs/AWS_STAGING.md](docs/AWS_STAGING.md)) is documented as a staging/scale-out target; confirm with your infrastructure owner whether this or the single-instance EC2 + local storage deployment is the live production environment before treating either as authoritative.
