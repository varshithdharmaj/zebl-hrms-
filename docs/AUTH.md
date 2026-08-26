# Authentication architecture

## Session model

- JWT session cookie via `jose` (`src/lib/session.ts`).
- Session payload: user id, email, role, optional `employeeId`.
- **Session version** invalidates tokens on logout/password change (`session-version-cache.ts`).

## Roles

| Role | Access |
|------|--------|
| `admin` | Full HR, settings, audit, operations |
| `manager` | Team approvals, manager dashboard |
| `employee` | Self-service attendance and leave |

Guards: `src/lib/auth-guards.ts` — `requireAdminSession`, `requireApproveLeaveSession`, etc.

Permissions: `src/lib/permissions.ts` — capability checks (`canAccessAdmin`, `canApproveLeave`).

## Microsoft SSO

- Routes: `/api/auth/microsoft`, callback handler.
- Config: `src/lib/auth/auth-config.ts` (Azure AD app registration).
- Provisioning links Entra users to employees.

## Local auth

- Email/password login (`actions/auth.ts`, `local-provider.ts`).
- `AUTH_SECRET` required in production (`config/validate.ts`).

## Public routes

Listed in `src/lib/public-routes.ts` — login, token approval links, health endpoints.

## Cron / workers

`src/lib/auth/cron-auth.ts` — `CRON_SECRET` header for worker API routes.
