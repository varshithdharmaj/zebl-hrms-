# Neon PostgreSQL setup

## 1. Create a Neon project

1. Sign up at [https://neon.tech](https://neon.tech)
2. Create a project and database
3. Copy the **connection string** (must include `?sslmode=require`)

## 2. Configure `.env` (local only — never commit)

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
AUTH_SECRET=your-long-random-secret-at-least-32-chars
APP_BASE_URL=http://localhost:3000
```

Use `.env.example` as a template. Real values belong only in `.env` / `.env.local` (both gitignored).

## 3. Verify and migrate

```bash
npm run db:check-env
npm run db:ping
npx prisma migrate deploy    # production / CI
# OR first-time dev:
npx prisma migrate dev --name init_postgres
npm run db:seed
npm run dev
```

## 4. Prisma workflow on Neon

| Command | When |
|---------|------|
| `npm run db:ping` | After changing `DATABASE_URL` |
| `npx prisma migrate dev` | Local schema changes (creates migration SQL) |
| `npx prisma migrate deploy` | Apply migrations in CI/production |
| `npx prisma studio` | Inspect tables |

## 5. Legacy SQLite migrations

Old SQLite SQL is archived under `prisma/migrations_sqlite_archive/`.  
PostgreSQL baseline: `prisma/migrations/*_init_postgres/`.

## 6. Security

- Rotate Neon password if exposed in chat, logs, or commits
- Use Neon **branch** databases for preview environments
- Do not log `DATABASE_URL` in application code

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| SSL required | Add `?sslmode=require` to connection string |
| P1001 timeout | Check Neon project is active (not suspended) |
| EPERM on `prisma generate` | Stop `npm run dev`, retry generate |
