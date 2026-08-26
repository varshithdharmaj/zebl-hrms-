# Contributing / developer guide

## Prerequisites

- Node 22+
- PostgreSQL (Docker Compose provided)
- Copy `.env.example` → `.env` (if present) or set vars from [DEPLOYMENT.md](./DEPLOYMENT.md)

## Setup

```bash
npm install
npm run db:postgres:up   # optional
npm run db:setup
npm run dev
```

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test
npm run validate    # all three
```

## Code conventions

| Concern | Location |
|---------|----------|
| Read queries | `src/lib/data/` |
| Validation | `src/lib/validation/` (Zod) |
| Mutations | `src/actions/` |
| API errors | `withAuthenticatedApi`, `AppError` |
| UI primitives | `src/components/ui/` |
| Design tokens | `src/lib/design/tokens.ts` |

## Adding a feature (internal)

1. Extend Prisma schema if needed + phase migration script
2. Add read queries to `lib/data` or domain query module
3. Server action or API route with validation + audit log
4. UI using shared table/toolbar components
5. Tests in `tests/unit` or `tests/integration`

## Pre-commit (recommended)

```bash
npx husky init
```

Add `.husky/pre-commit`:

```sh
npm run validate
```

Or use `lint-staged` for faster commits (see `package.json` `lint-staged` field).

## Do not

- Add new integrations without P1/P2 approval
- Put Prisma calls in client components
- Skip audit logs on admin mutations
