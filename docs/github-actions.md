# GitHub Actions

CI and security scanning for ZEBL_AMS. Workflows live under `.github/workflows/`.

## Architecture overview

| Workflow | File | Purpose |
|----------|------|---------|
| **CI** | `ci.yml` | Install, Prisma validate, typecheck, lint, test, Next.js build |
| **CodeQL** | `codeql.yml` | Static analysis for TypeScript security issues |
| **Dependabot** | `dependabot.yml` | Weekly grouped dependency update PRs |

Every push and pull request targeting `main` runs **CI**. CodeQL also runs on a weekly schedule.

Duplicate in-progress runs for the same ref are cancelled via `concurrency`.

---

## CI (`ci.yml`)

### Purpose

Gate merges with the same quality checks developers run locally. Fail-fast: any failing step fails the job.

### Triggers

- `push` to `main`
- `pull_request` targeting `main`

### Job: `quality`

| Step | Command / action | Notes |
|------|------------------|--------|
| Checkout | `actions/checkout@v4` | Full workspace |
| Setup Node | `actions/setup-node@v4` | Node **22** (matches `docs/CONTRIBUTING.md`), npm cache |
| Install | `npm ci` | Lockfile-strict; `postinstall` runs Prisma generate |
| Generate Prisma | `npm run db:generate` | Explicit client + browser type patch |
| Validate schema | `npx prisma validate` | Schema syntax / datasource config |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Lint | `npm run lint` | `next lint` |
| Test | `npm test` | `vitest run` (unit suite; no DB) |
| Build | `npm run build` | Prisma generate + `next build` |

### CI environment variables

Placeholders only (not secrets). They satisfy `prebuild` / Prisma env checks without a live database:

- `DATABASE_URL` — dummy PostgreSQL URL
- `AUTH_SECRET` — non-production placeholder
- `APP_BASE_URL` — `http://localhost:3000`

Unit tests do not require a real database. Integration tests are not part of this workflow.

### Permissions

```yaml
permissions:
  contents: read
```

---

## CodeQL (`codeql.yml`)

### Purpose

Detect common security vulnerabilities in TypeScript via GitHub Advanced Security / Code Scanning.

### Triggers

- `push` / `pull_request` on `main`
- Weekly schedule: Mondays 06:00 UTC

### Job: `analyze`

1. Checkout
2. Initialize CodeQL (`javascript-typescript`, `security-extended` queries)
3. Autobuild
4. Analyze and upload results to the Security tab

### Permissions

```yaml
permissions:
  contents: read
  security-events: write
  actions: read
```

`security-events: write` is required to upload SARIF results.

---

## Dependabot (`dependabot.yml`)

### Purpose

Open weekly PRs for npm and GitHub Actions updates, grouped to reduce noise (Prisma, Next/ESLint, React, Radix, etc.).

### Schedule

Monday, weekly. Groups related packages into fewer PRs.

Dependabot PRs still run **CI** via the pull_request trigger.

---

## How to rerun workflows

1. Open the failed run: **Actions** → select workflow → select run.
2. **Re-run all jobs** or **Re-run failed jobs**.
3. Or push an empty commit / make a small commit to re-trigger.

For a PR: **Checks** tab → failed check → **Re-run**.

---

## How to debug failures

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `npm ci` fails | Lockfile out of sync | Run `npm install` locally, commit `package-lock.json` |
| Prisma validate/generate fails | Schema or env | Confirm `DATABASE_URL` format; run `npx prisma validate` locally |
| Typecheck fails | TS errors | `npm run typecheck` locally; fix reported files |
| Lint fails | ESLint rules | `npm run lint` locally |
| Tests fail | Assertion / import | `npm test`; check Vitest output |
| Build fails | Next/Prisma/`prebuild` | Reproduce with same env placeholders; check `prebuild` DB check |
| CodeQL fails | Query / autobuild | Inspect CodeQL logs; ensure TS project builds |

Always reproduce locally with the commands below before pushing fixes.

---

## Local commands matching CI

```bash
npm ci
npm run db:generate
npx prisma validate
npm run typecheck
npm run lint
npm test
npm run build
```

Shortcut for typecheck + lint + test (no Prisma validate / build):

```bash
npm run validate
```

With CI-like env (PowerShell):

```powershell
$env:DATABASE_URL="postgresql://ci:ci@127.0.0.1:5432/zebl_ams_ci?schema=public"
$env:AUTH_SECRET="ci-build-placeholder-not-for-production"
$env:APP_BASE_URL="http://localhost:3000"
npm run build
```

---

## Package scripts reused

| Script | Role in CI |
|--------|------------|
| `db:generate` | Prisma client + patch |
| `typecheck` | TypeScript |
| `lint` | ESLint |
| `test` | Vitest |
| `build` | Production Next.js build |

No new npm scripts were added. `npx prisma validate` is used directly (`db:validate` validates migrations, not the schema file).

Optional future script (not required):

```json
"prisma:validate": "prisma validate"
```

---

## Status badges

See root [README.md](../README.md):

- CI build badge → `ci.yml`
- CodeQL badge → `codeql.yml`

---

## Related docs

- [CONTRIBUTING.md](./CONTRIBUTING.md) — local quality gates
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production deploy (Vercel / Cloudflare)
