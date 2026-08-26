# PostgreSQL — migration complete (P1)

**Status:** AMS now requires PostgreSQL. See [DATABASE_SETUP.md](./DATABASE_SETUP.md), [MIGRATIONS.md](./MIGRATIONS.md), and [DEPLOYMENT.md](./DEPLOYMENT.md).

**Local `.env` must not use** `DATABASE_URL="file:..."` — Prisma will refuse to start.

## What changed in P1

- Prisma `provider = postgresql`
- Queue claiming uses `FOR UPDATE SKIP LOCKED`
- `worker_heartbeats` table for operational monitoring
- Phase migration scripts verify schema via `information_schema` (no SQLite DDL)
- Config validation rejects `file:` DATABASE_URL

## Connection pooling

Use PgBouncer or Prisma URL parameters:

```
postgresql://user:pass@host:5432/zebl_ams?connection_limit=10
```

## Remaining consolidation work

- Merge legacy `prisma/migrations/*.sql` (SQLite era) into one PostgreSQL migration history
- Automated SQLite → Postgres data ETL (currently manual)
