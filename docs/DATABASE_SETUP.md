# Database setup (PostgreSQL)

AMS **requires PostgreSQL**. SQLite `file:` URLs will not work with the current Prisma schema.

## Verify configuration

```bash
npm run db:check-env    # URL format (rejects SQLite)
npm run db:ping         # TCP + Prisma — catches "Can't reach localhost:5432"
npx prisma validate
```

**No PostgreSQL on Windows?** See [POSTGRES_WINDOWS_SETUP.md](./POSTGRES_WINDOWS_SETUP.md) (Docker, Neon, Supabase, native install).

`npm run dev` runs `predev` automatically (same check).

If you still see `postgresql://` errors while `.env` looks correct:

1. Check for **`.env.local`** overriding `.env` with `file:./...`
2. Check **Windows user/system** `DATABASE_URL` environment variable
3. Restart the terminal and `npm run dev` after editing `.env`

## Quick fix (local)

1. **Update `.env`** (copy from `.env.example` if needed):

```env
DATABASE_URL="postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams"
APP_BASE_URL="http://localhost:3000"
AUTH_SECRET="your-secret-at-least-32-characters-long"
```

2. **Start PostgreSQL** (pick one):

| Option | Command / action |
|--------|------------------|
| Docker | `npm run db:postgres:up` (requires Docker Desktop) |
| Native install | Create database `zebl_ams`, user `zebl`, adjust URL |
| Neon / Supabase / Railway | Paste hosted connection string as `DATABASE_URL` |

3. **Stop the Next.js dev server** (avoids Windows `EPERM` on `prisma generate`).

4. **Apply schema and seed:**

```bash
npx prisma generate
npm run db:setup
npm run db:validate
```

5. **Run the app:**

```bash
npm run dev
```

## Connection string formats

| Provider | Example |
|----------|---------|
| Local Docker | `postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams` |
| Neon | `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require` |
| Supabase | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| Railway | `postgresql://postgres:pass@host.railway.app:5432/railway` |

## Startup validation

On boot, `instrumentation.ts` will **fail fast** if `DATABASE_URL` is missing or still uses SQLite.

`src/lib/prisma.ts` validates the URL before creating `PrismaClient`.

Optional strict DB probe: set `ZEBL_STRICT_DB_STARTUP=true` to throw if Postgres is unreachable (default: warn only).

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `URL must start with postgresql://` | SQLite `file:` in `.env` | Update `DATABASE_URL` |
| `P1001: Can't reach database server` | Postgres not running | Start Docker/native/hosted DB |
| `EPERM` on `prisma generate` | Dev server locking engine | Stop `npm run dev`, retry generate |

## Rollback to SQLite?

**Not supported** after P1. The schema uses PostgreSQL-only features (`FOR UPDATE SKIP LOCKED`, enums). Use PostgreSQL for all environments.
