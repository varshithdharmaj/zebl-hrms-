# Database migration strategy

Zebl requires **PostgreSQL**. SQLite is no longer supported.

## Local development (Neon)

```bash
cp .env.example .env   # set DATABASE_URL from Neon dashboard
npm run db:ping
npx prisma migrate deploy
npm run db:seed
npm run dev
```

See [NEON_SETUP.md](./NEON_SETUP.md).

## Local development (Docker)

```bash
npm run db:postgres:up
cp .env.example .env
npm run db:ping
npm run db:setup
```

## Production schema apply

```bash
npx prisma generate
npx prisma db push
npm run db:migrate-phase3
npm run db:migrate-phase4
npm run db:migrate-phase5
npm run db:migrate-phase6
npm run db:migrate-phase7
npm run db:validate
```

Use `prisma migrate deploy` once SQL migrations are consolidated into a single PostgreSQL baseline.

## Phase scripts (3–7)

Idempotent TypeScript migrations for features added after the initial Prisma SQL baseline:

| Script | Feature |
|--------|---------|
| `db:migrate-phase3` | Notifications |
| `db:migrate-phase4` | Email approval tokens |
| `db:migrate-phase5` | Microsoft SSO |
| `db:migrate-phase6` | Integrations / Teams |
| `db:migrate-phase7` | Analytics |

## Upgrading from SQLite

**Do not** keep `DATABASE_URL="file:./..."` — Prisma will fail at startup with `PrismaClientInitializationError`.

1. Stop the dev server (Windows: unlocks Prisma engine files).
2. Update `.env`:
   ```env
   DATABASE_URL="postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams"
   APP_BASE_URL="http://localhost:3000"
   ```
3. Start Postgres: `npm run db:postgres:up`
4. Apply schema: `npx prisma generate && npm run db:setup`
5. Export old SQLite data from `prisma/attendance_manager.db` if needed.
6. Import data (custom ETL or `npm run db:seed` for demo data).
7. Run `npm run db:migrate-postgres-check`

### Common startup error

```txt
the URL must start with the protocol postgresql:// or postgres://
```

**Fix:** Replace SQLite `file:` URL in `.env` with a PostgreSQL URL (see `.env.example`).

## P1 schema additions

- `notifications.locked_at`, `locked_by`
- `integration_jobs.locked_at`, `locked_by`, `updated_at`
- `worker_heartbeats` table

## Do not use in production

- `npm run db:push` on production without review (prefer tracked migrations)
- SQLite `file:` DATABASE_URL
