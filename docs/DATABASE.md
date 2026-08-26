# Database guide

## Engine

**PostgreSQL** (required in production). Schema: `prisma/schema.prisma`.

Local: `docker compose up -d` then `npm run db:setup`.

## Setup scripts

| Script | Purpose |
|--------|---------|
| `db:push` | Apply Prisma schema |
| `db:migrate-phase3` … `7` | Incremental column/index migrations |
| `db:seed` | Demo data |
| `db:validate` | Verify migration state |

See [MIGRATIONS.md](./MIGRATIONS.md) for phase history.

## Key entities

- `employees`, `users` — org + login
- `attendance_records`, `attendance_uploads`
- `leave_requests`, `leave_approval_steps`, `leave_balances`
- `notification_queue`, `integration_jobs`
- `audit_logs`, `approval_tokens`
- `worker_heartbeats`

## Query conventions

- **Reads:** `src/lib/data/*` or domain `*-queries.ts`
- **Transactions:** workflow advances, token consumption — always in `prisma.$transaction`
- **Pagination:** `PAGE_SIZE = 15` in `data/constants.ts`

## Backups

Production: use managed Postgres backups (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
