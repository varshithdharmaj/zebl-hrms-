# Zebl AMS

[![CI](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/ci.yml/badge.svg)](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/ci.yml)
[![CodeQL](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/codeql.yml/badge.svg)](https://github.com/varshithdharmaj/ZEBL_AMS/actions/workflows/codeql.yml)

Next.js 15 HR platform: attendance, leave, helpdesk, security, and recruitment. TypeScript, Tailwind, shadcn/ui, Prisma, **PostgreSQL** (Supabase / Neon / local).

## Features

- **Authentication** — Local login + optional Microsoft Entra ID SSO; login history and active sessions
- **Roles** — `admin`, `hr_admin`, `manager`, `employee` with separate shells
- **Attendance** — Records, dashboards, heatmaps; Excel/PDF biometric import (eSSL Daily/Summary), optional preview, resumable chunked jobs, duplicate-skip reporting
- **Leave workflow** — Multi-step approvals, balance deduction, cancellation, email one-time approve links (`/approve/[token]`)
- **Recruitment** — Jobs → candidates/resume import → applications/pipeline → interviews → offers → employee conversion; communications, documents, analytics/reports
- **Helpdesk** — Employee/admin tickets, comments, notifications, audit
- **Security** — Role-based access, session revocation, password change, security hubs, audit log
- **Notifications** — Email queue + optional Microsoft Teams webhooks
- **Integrations** — Calendar sync, org sync, escalation worker
- **Analytics** — Workforce metrics and admin dashboards

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup (recommended)

```bash
npm install
cp .env.example .env     # fill DATABASE_URL, AUTH_SECRET (never commit .env)
npm run db:ping          # verifies Postgres connectivity
npx prisma migrate deploy
npm run db:seed
npm run dev
```

**Supabase / Cloudflare:** [docs/CLOUDFLARE_SUPABASE_STACK.md](docs/CLOUDFLARE_SUPABASE_STACK.md) · **Neon:** [docs/NEON_SETUP.md](docs/NEON_SETUP.md) · **Local Docker:** `npm run db:postgres:up` · **Troubleshooting:** [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)

Or step-by-step — see [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:migrate-phase3
npm run db:migrate-phase4
npm run db:migrate-phase5
npm run db:migrate-phase6
npm run db:migrate-phase7
npm run db:seed
npm run db:validate
```

Optional demo data:

```bash
npm run seed:demo        # recruitment demo seed
npm run demo:seed        # general demo seed
```

Open [http://localhost:3000](http://localhost:3000)

### Default admin login

- **Email:** hr@zebl.com
- **Password:** Hr@2026

## Environment variables

See [.env.example](.env.example). Required:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AUTH_SECRET` | JWT session signing |
| `APP_BASE_URL` | Links in approval/notification emails |

Optional: SMTP, `APPROVAL_TOKEN_SECRET`, Microsoft SSO (`AZURE_AD_*`), `TEAMS_WEBHOOK_URL`, cron secrets (`NOTIFICATION_CRON_SECRET`, `INTEGRATION_CRON_SECRET`), `ENABLE_ATTENDANCE_IMPORT_PREVIEW`.

## Background workers

Run on a schedule (cron, Task Scheduler, or platform scheduler):

| Command | Purpose |
|---------|---------|
| `npm run notifications:process` | Drain email/Teams notification queue |
| `npm run integrations:process` | Calendar sync, escalation scan |
| `npm run analytics:process` | Analytics snapshots |

HTTP triggers (protect with Bearer cron secrets):

- `POST /api/notifications/process`
- `POST /api/integrations/process`
- `POST /api/analytics/process`

Health:

- `GET /api/health` — liveness
- `GET /api/health/deep` — queues, workers, config (auth required)

Admin operations:

- `/admin/operations` — worker health, queue depth, failed jobs
- `/admin/audit` — searchable audit log with export

## Microsoft SSO

Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, and `AZURE_AD_REDIRECT_URI`. Optional role maps: `AZURE_AD_GROUP_ROLE_MAP`, `AZURE_AD_APP_ROLE_MAP`.

## Teams notifications

1. Create an Incoming Webhook in a Teams channel.
2. Set `TEAMS_WEBHOOK_URL` in `.env` or configure in **Admin → Integrations**.
3. Enable Teams toggles in integration settings.
4. Ensure `notifications:process` runs regularly.

## Tests

```bash
npm test
npm run validate   # typecheck + lint + test
```

Unit tests run without a database. Integration tests require `DATABASE_URL=postgresql://...` and `npm run db:setup`.

## Documentation

### Core

- [docs/DAYWISE_DEVELOPMENT_LOG.md](docs/DAYWISE_DEVELOPMENT_LOG.md) — day-wise delivered outcomes
- [docs/github-actions.md](docs/github-actions.md) — CI, CodeQL, Dependabot
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview and layers
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — developer setup and conventions
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — leave workflow engine
- [docs/AUTH.md](docs/AUTH.md) — sessions, roles, SSO
- [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) — queue and channels
- [docs/DATABASE.md](docs/DATABASE.md) — schema and query conventions
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Graph, Teams, calendar
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — operational fixes
- [docs/CODE_OWNERSHIP.md](docs/CODE_OWNERSHIP.md) — module boundaries
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — migration order and rules
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production runbook
- [docs/CLOUDFLARE_SUPABASE_STACK.md](docs/CLOUDFLARE_SUPABASE_STACK.md) — Cloudflare / Supabase stack

### Recruitment

- [docs/RECRUITMENT_PRD.md](docs/RECRUITMENT_PRD.md)
- [docs/RECRUITMENT_ARCHITECTURE.md](docs/RECRUITMENT_ARCHITECTURE.md)
- [docs/RECRUITMENT_SCHEMA_DESIGN.md](docs/RECRUITMENT_SCHEMA_DESIGN.md)
- [docs/RECRUITMENT_TECHNICAL_SPEC.md](docs/RECRUITMENT_TECHNICAL_SPEC.md)
- [docs/RECRUITMENT_IMPLEMENTATION_BLUEPRINT.md](docs/RECRUITMENT_IMPLEMENTATION_BLUEPRINT.md)

### Attendance import

- [docs/attendance-import-phase1.md](docs/attendance-import-phase1.md) … [phase5b](docs/attendance-import-phase5b.md)

## Tech stack

- Next.js 15 (App Router), React 19
- Prisma ORM, PostgreSQL (Supabase / Neon / Docker)
- Jose (JWT), bcrypt, nodemailer, openid-client
- Deploy: Vercel and Cloudflare/OpenNext (`npm run cf:build` / `cf:deploy`)

## Project structure

```
src/
├── app/              # Routes (admin, manager, employee, approve, api)
├── actions/          # Server actions
├── components/       # UI by role/domain (incl. recruitment/)
└── lib/
    ├── data/         # Centralized read models
    ├── validation/   # Zod schemas
    ├── errors/       # AppError + API handlers
    ├── workflow/     # Leave engine
    ├── recruitment/  # Hiring domain services/repos
    └── ...           # auth, notifications, integrations
prisma/
├── schema.prisma
├── migrations/
├── recruitment-demo/ # Demo seed helpers
└── scripts/          # Phase migrations + workers
tests/
├── fixtures/         # Shared test data
├── helpers/
├── unit/
└── integration/
```
