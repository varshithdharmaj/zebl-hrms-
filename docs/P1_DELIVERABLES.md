# P1 stabilization — deliverables

## 1. PostgreSQL migration report

| Item | Status |
|------|--------|
| Prisma `provider = postgresql` | Done |
| Docker Compose dev Postgres | `docker-compose.yml` |
| Queue/worker indexes + lock columns | `locked_at`, `locked_by`, composite indexes |
| `WorkerHeartbeat` model | Done |
| SQLite fallback removed | Config rejects non-Postgres URLs |
| Data migration script | `npm run db:migrate-postgres-check` |
| Rollback strategy | Documented in DEPLOYMENT.md (restore pg_dump) |

**Fresh install:** `docker compose up -d` → set `DATABASE_URL` → `npx prisma db push` → phase scripts → seed.

**SQLite upgrade:** export data manually; run postgres check script; no dual-DB runtime.

## 2. Worker reliability

- `src/lib/workers/worker-manager.ts` — single run + optional loop, SIGINT/SIGTERM graceful stop
- `worker-health.ts` — heartbeat upsert, stale detection (5 min)
- CLI scripts use `runManagedWorkerCli`
- API cron routes record heartbeat via `runManagedWorkerOnce`

## 3. Queue hardening

- `claimDueNotificationIds` / `claimDueIntegrationJobIds` — `FOR UPDATE SKIP LOCKED`
- `releaseStuckNotifications` / `releaseStuckIntegrationJobs` — 15 min processing timeout
- Idempotent claim via atomic UPDATE…RETURNING
- Dead-letter remains `failed` status with audit trail

## 4. Audit viewer

- **Route:** `/admin/audit`
- Search, entity/action filters, pagination, CSV export
- **Lib:** `src/lib/audit/audit-queries.ts`

## 5. Operations dashboard

- **Route:** `/admin/operations`
- Queue depth, failed jobs, worker health, integration Graph status, workflow integrity issues
- **Lib:** `src/lib/operations/ops-queries.ts`

## 6. Performance optimization

| Change | Impact |
|--------|--------|
| Composite index `(status, scheduled_at)` on queues | Faster due-job scans |
| SKIP LOCKED claims | Less worker contention |
| Audit `(action)` index | Faster audit filters |
| Workflow scan capped at 500 rows | Bounded admin ops load |

Profiling: run `EXPLAIN ANALYZE` on claim queries in staging.

## 7. Health checks

- `GET /api/health` — database only
- `GET /api/health/deep` — config, queues, workers, SMTP/Teams config (auth required)

## 8. Deployment readiness

See [DEPLOYMENT.md](./DEPLOYMENT.md).

## 9. Logging / observability

- `src/lib/observability/logger.ts` — JSON structured logs
- `correlation.ts` — IDs for workers and workflows
- Workers log run results and errors

## 10. Remaining operational risks

| Risk | Mitigation |
|------|------------|
| Phase TS migrations still separate from Prisma SQL | Consolidate when stabilizing prod |
| No automatic SQLite data ETL | Manual export/import for upgrades |
| Worker heartbeats in DB only | Monitor via /admin/operations |
| SMTP/Teams deep health is config-only | Add active probe if needed |
| Multi-instance workers need SKIP LOCKED | Supported on PostgreSQL |
