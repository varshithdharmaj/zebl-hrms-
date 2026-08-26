# Archived SQLite migrations

These SQL files were generated for SQLite and are **not** applied to PostgreSQL or Neon.

PostgreSQL baseline: `prisma/migrations/*_init_postgres/` (created via `prisma migrate dev`).

For new environments use:

```bash
npx prisma migrate deploy
npm run db:migrate-phase3
# ... through phase7 if needed on existing DBs
```

Fresh Neon databases: `migrate deploy` + optional phase scripts per `docs/MIGRATIONS.md`.
