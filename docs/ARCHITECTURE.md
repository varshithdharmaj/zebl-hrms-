# AMS architecture overview

Zebl Attendance Manager (AMS) is a Next.js 15 internal HR platform for attendance, leave workflows, notifications, and Microsoft integrations.

## Layered structure

```
src/
├── app/              # Routes (App Router): pages + API
├── actions/          # Server actions (mutations, FormData)
├── components/       # React UI by role/domain
└── lib/
    ├── data/         # Read models (Prisma queries)
    ├── validation/   # Zod schemas + parse helpers
    ├── errors/       # AppError, API handlers, correlation IDs
    ├── workflow/     # Leave workflow engine
    ├── notifications/
    ├── integrations/
    ├── auth/         # OAuth providers, cookies
    ├── config/       # Env + startup validation
    ├── observability/
    └── design/       # UI tokens
```

## Request flow

1. **Middleware** (`src/middleware.ts`) — session check, public routes, session version cache.
2. **Page / API** — loads data via `lib/data` or domain query modules.
3. **Mutations** — server actions or API routes call workflow/services; audit log on sensitive changes.
4. **Background** — workers (`npm run notifications:process`, etc.) process queues.

## Data access

- **Reads:** `@/lib/data` (attendance, employees, leaves, dashboard stats).
- **Domain reads:** `audit/audit-queries.ts`, `hr/command-center.ts`, `operations/ops-queries.ts`.
- **Writes:** workflow engine, actions, upload pipeline — keep Prisma in service modules, not UI.

## Error handling

- **Actions:** return `{ error?, success? }` (`ActionState`).
- **API:** `withAuthenticatedApi` + `AppError` + `x-correlation-id` header.
- **Domain:** `WorkflowError`, `PermissionError` mapped via `toAppError`.

## Related docs

- [AUTH.md](./AUTH.md)
- [WORKFLOW.md](./WORKFLOW.md)
- [NOTIFICATIONS.md](./NOTIFICATIONS.md)
- [DATABASE.md](./DATABASE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [CODE_OWNERSHIP.md](./CODE_OWNERSHIP.md)
