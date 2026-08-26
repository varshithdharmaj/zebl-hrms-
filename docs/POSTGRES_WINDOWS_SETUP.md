# PostgreSQL on Windows (no Docker)

AMS requires a running PostgreSQL server. If `npm run db:ping` reports **connection refused** on `localhost:5432`, use one of these paths.

## Option A — Docker Desktop (recommended)

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop (wait until it is running)
3. In the project folder:

```powershell
cd D:\AMS_Zebl
npm run db:postgres:up
npm run db:ping
npm run db:setup
npm run dev
```

`docker-compose.yml` creates:

| Setting | Value |
|---------|--------|
| Host | `localhost` |
| Port | `5432` |
| User | `zebl` |
| Password | `zebl_dev_password` |
| Database | `zebl_ams` |

`.env` is already aligned with these credentials.

## Option B — Neon (free cloud, no local install)

1. Sign up at [https://neon.tech](https://neon.tech)
2. Create a project → copy the **connection string**
3. Replace `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

4. Run:

```powershell
npm run db:ping
npx prisma generate
npm run db:setup
npm run dev
```

## Option C — Supabase

1. Create project at [https://supabase.com](https://supabase.com)
2. Settings → Database → Connection string (URI)
3. Set `DATABASE_URL` in `.env` (use **Session** or **Direct** mode per Supabase docs)
4. `npm run db:ping` → `npm run db:setup` → `npm run dev`

## Option D — Native PostgreSQL on Windows

1. Download installer: [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Install PostgreSQL 16, note the superuser password
3. Open **pgAdmin** or `psql` and run:

```sql
CREATE USER zebl WITH PASSWORD 'zebl_dev_password';
CREATE DATABASE zebl_ams OWNER zebl;
GRANT ALL PRIVILEGES ON DATABASE zebl_ams TO zebl;
```

4. Ensure the Windows service **postgresql-x64-16** is running (Services app)
5. `.env`:

```env
DATABASE_URL="postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams"
```

6. `npm run db:ping` → `npm run db:setup`

## Verify port 5432 (PowerShell)

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

`TcpTestSucceeded : True` means something is listening.

## Commands reference

| Command | Purpose |
|---------|---------|
| `npm run db:check-env` | Validates URL format (not SQLite) |
| `npm run db:ping` | TCP + Prisma connectivity test |
| `npm run db:postgres:up` | Start Docker Postgres |
| `npm run db:setup` | Push schema + phase migrations + seed |
| `npm run dev` | Start app (runs checks first) |

## Skip strict startup (temporary only)

```env
ZEBL_SKIP_DB_STARTUP=true
```

Use only to work on UI without a DB. Login and audit will still fail until PostgreSQL is available.
