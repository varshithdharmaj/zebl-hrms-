# Zebl AMS — Deploy on Vercel + Neon (free tier)

Internal company HR/attendance app. **No Docker, no VPS, no custom domain required** for first deployment.

| Layer | Service |
|-------|---------|
| App | [Vercel](https://vercel.com) (Hobby / free) |
| Database | [Neon](https://neon.tech) PostgreSQL (free tier) |
| ORM | Prisma |

---

## Quick start (first deploy)

### 1. Neon PostgreSQL

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **pooled** connection string for Vercel (host often contains `-pooler`). Use the direct (non-pooled) URL only for local `prisma migrate`.
3. Append SSL if missing: `?sslmode=require`

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

4. Apply schema (run locally once, against Neon):

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Seed creates admin user (`hr@zebl.com` / see `prisma/seed.ts` — change password after first login).

### 2. Vercel project

1. Push repo to GitHub/GitLab/Bitbucket.
2. [Import project](https://vercel.com/new) → select repo.
3. Framework: **Next.js** (auto-detected).
4. Build command (default is fine): `prisma generate && next build` via `npm run build`.
5. Add **Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | **Yes** | Neon PostgreSQL URL with `?sslmode=require` |
| `AUTH_SECRET` | **Yes** | 32+ random chars (`openssl rand -base64 32`) |
| `APP_BASE_URL` | Recommended | `https://your-project.vercel.app` — optional on Vercel; `VERCEL_URL` is used if unset |
| `NOTIFICATION_CRON_SECRET` | Optional | Random string; protects worker HTTP endpoints |
| `INTEGRATION_CRON_SECRET` | Optional | Same |
| `ANALYTICS_CRON_SECRET` | Optional | Same |

6. Deploy.

7. Open `https://<project>.vercel.app/login`.

---

## Environment variable checklist

### Required for production

```env
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
AUTH_SECRET=<32+ character secret>
```

### Strongly recommended

```env
APP_BASE_URL=https://your-project.vercel.app
NOTIFICATION_CRON_SECRET=<random>
```

### Optional (features disabled if unset)

| Variable | Feature |
|----------|---------|
| `SMTP_*`, `EMAIL_FROM` | Email notifications |
| `AZURE_AD_*` | Microsoft SSO |
| `GRAPH_*` | Calendar / org sync |
| `TEAMS_WEBHOOK_URL` | Teams cards |
| `APPROVAL_TOKEN_SECRET` | Email approve links (falls back to `AUTH_SECRET`) |

**Not used:** `NEXTAUTH_URL` / NextAuth — AMS uses custom JWT sessions (`AUTH_SECRET`).

---

## Build & Prisma on Vercel

- `postinstall`: `prisma generate` (runs on Vercel install).
- `prebuild`: validates `DATABASE_URL` format — **must be set in Vercel env before build**.
- `build`: `prisma generate && next build`.

If build fails with Prisma client errors:

```bash
# locally, after schema changes
npx prisma generate
git push
```

If `EPERM` on Windows during `prisma generate`, stop `npm run dev` first.

---

## Neon connection tips (serverless)

- Use Neon **pooled** connection string for Vercel functions when available.
- Keep `?sslmode=require`.
- Neon free tier may **suspend** after inactivity — first request after idle can be slow (cold start + DB wake).
- Run migrations from your machine or CI, not from Vercel build:

```bash
DATABASE_URL="..." npx prisma migrate deploy
```

---

## Auth on Vercel

- Sessions: HTTP-only cookie `zebl_session`, JWT signed with `AUTH_SECRET`.
- Production cookies: `secure: true`, `sameSite: lax` (HTTPS on `*.vercel.app`).
- Middleware uses `jose` (Edge-compatible) — no DB in middleware.
- OAuth redirect (if Microsoft SSO enabled):

```env
AZURE_AD_REDIRECT_URI=https://your-project.vercel.app/api/auth/microsoft/callback
```

Register that URI in Azure App Registration.

---

## File uploads (attendance Excel)

- Uploads are parsed **in memory** and stored in **PostgreSQL** (`attendance_records`).
- **No** persistent `/uploads` folder — compatible with Vercel serverless.
- Limit: server action body ~10 MB (`next.config.ts`).

---

## Background jobs & cron (free-tier limits)

Vercel Hobby **does not** run long-lived workers or built-in cron (cron requires Pro).

| Feature | On Vercel free | Workaround |
|---------|----------------|------------|
| Login / attendance / payroll UI | Works | — |
| Excel upload | Works | In-request processing |
| Payroll export | Works | API route download |
| Notification queue | **Manual / external cron** | `POST /api/notifications/process` with `Authorization: Bearer NOTIFICATION_CRON_SECRET` |
| Integration jobs | **Manual / external cron** | `POST /api/integrations/process` |
| Analytics batch | **Manual** | Admin → Analytics or `npm run analytics:process` locally |
| Payroll recompute | Works | On page load (serverless) |

Use a free external cron (e.g. [cron-job.org](https://cron-job.org)) to hit your worker URLs every few minutes if you need email notifications in production.

**Admin operations:** `/admin/operations` — process queues manually.

---

## Health checks

| Endpoint | Auth | Use |
|----------|------|-----|
| `GET /api/health` | Public | Uptime / DB ping |
| `GET /api/health/deep` | Cron secret or admin | Queues, workers |

---

## Common deployment failures

| Symptom | Cause | Fix |
|---------|--------|-----|
| `prisma.payrollSettings` undefined | Client not generated | `postinstall` / redeploy after `prisma generate` |
| `DATABASE_URL is not set` at build | Missing Vercel env | Add `DATABASE_URL` in project settings |
| `Configuration validation failed` | Missing `AUTH_SECRET` | Set 32+ char secret |
| `Can't reach database server` | Neon asleep / wrong URL | Wake Neon; check pooled URL & SSL |
| `server-only` in client bundle | Importing Prisma in client code | Import server libs only in Server Components / actions |
| OAuth redirect mismatch | Wrong callback URL | Match `APP_BASE_URL` + Azure redirect URI |
| Emails not sending | No SMTP | Configure SMTP or use in-app only |
| Notifications stuck | No cron | Trigger `/api/notifications/process` manually or external cron |

---

## Post-deploy verification

- [ ] `GET /api/health` returns OK
- [ ] Login at `/login` (seed admin)
- [ ] `/admin/attendance` loads
- [ ] `/admin/payroll-attendance` loads
- [ ] Excel upload on `/admin/upload`
- [ ] Payroll export downloads `.xlsx`
- [ ] Middleware redirects unauthenticated users to `/login`

---

## Local vs production

| | Local | Vercel |
|--|-------|--------|
| `APP_BASE_URL` | `http://localhost:3000` | `https://*.vercel.app` or explicit |
| Database | Neon or Docker Postgres | Neon only |
| Workers | `npm run notifications:process` | HTTP cron or manual |
| Migrations | `npx prisma migrate deploy` | Same, run from dev machine/CI |

---

## Security (internal use)

- Rotate Neon password if exposed.
- Use strong `AUTH_SECRET`.
- Set cron secrets in production.
- Do not commit `.env` (gitignored).

See also: [NEON_SETUP.md](./NEON_SETUP.md), [DATABASE_SETUP.md](./DATABASE_SETUP.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
