# SQLite → PostgreSQL migration readiness

**Status:** PostgreSQL baseline applied (`init_postgres` migration). Neon supported with `?sslmode=require`.

**Runtime requirement:** a reachable PostgreSQL instance (Neon, Docker, or native).

## Schema & provider

| Item | Status |
|------|--------|
| `provider = "postgresql"` | Done |
| SQLite `file:` URLs | Rejected at startup |
| Enums | Native PostgreSQL enums |
| JSON metadata fields | `String` columns (JSON serialized) — compatible |
| Transactions | `prisma.$transaction` + `FOR UPDATE SKIP LOCKED` in queue workers |

## Migration scripts

| Layer | Notes |
|-------|--------|
| `npx prisma db push` | Applies current schema |
| Phase 3–7 TS scripts | Idempotent; use `information_schema` |
| Legacy phase0/hr SQLite scripts | Historical only — do not run on PostgreSQL |
| `prisma/migrations/*.sql` | SQLite-era SQL — consolidation pending |

## Data migration

- No automatic SQLite → Postgres ETL in repo
- Manual export/import or `npm run db:seed` for demo data
- `npm run db:migrate-postgres-check` validates Postgres schema tables exist

## Operational checklist

```bash
npm run db:check-env
npm run db:ping          # must pass before dev
npm run db:setup         # first time
npm run dev
```

## Remaining risks

1. Assumption of `localhost:5432` without running server (fixed via `db:ping` + fail-fast startup)
2. Multi-instance deploy needs shared session/rate-limit store (separate from DB migration)
3. Consolidate SQL migration history into single PostgreSQL baseline
