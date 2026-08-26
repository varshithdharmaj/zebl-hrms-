# P0 hardening sprint — deliverables

## 1. P0 fixes summary

| Issue | Fix |
|-------|-----|
| Token consumed before workflow | Single `prisma.$transaction`: optimistic `updateMany` → workflow → revoke siblings; rollback restores `active` on failure |
| Logged-in users blocked from `/approve` | Approval paths exempt from “redirect authenticated users away” in middleware |
| Middleware JWT-only sessions | Session version cache + invalidation on logout; stale JWT cleared on protected routes |
| Teams always enabled | `isTeamsIntegrationEnabled()` checks DB settings + webhook URL (removed `\|\| true`) |
| Migration chaos | `docs/MIGRATIONS.md`, `npm run db:setup`, `npm run db:validate` |
| No tests | Vitest suite: workflow, tokens, auth, notifications, route guards |
| Docs outdated | README, `.env.example` alignment, operational worker table |
| Dead code | Removed unused `getAuditHistory`, `resolveHrApprovers` |
| Logout session gap | `invalidateUserSessionsWithAudit` on logout |

## 2. Token transaction fix

**Before:** Token marked `consumed`, then `advanceWorkflow`/`rejectWorkflow` ran outside a shared transaction. Failure left a burned link.

**After:** `consumeApprovalToken` runs one transaction:

1. `updateMany` where `status=active` → `consumed` (optimistic lock)
2. `advanceWorkflow` / `rejectWorkflow` with shared `tx`
3. Revoke sibling tokens + audit logs in the same `tx`

Any `WorkflowError` or DB error rolls back step 1, so the link stays usable.

## 3. Middleware / session fix

- **`src/lib/public-routes.ts`** — `/approve` and `/api/approve` stay reachable when a session cookie exists.
- **`src/lib/session-version-cache.ts`** — In-process map of `userId → sessionVersion` (60s TTL), populated on `getSession()` and invalidation.
- **Logout** increments `sessionVersion` and writes audit `auth.session.invalidated`.
- **Middleware** rejects stale JWT on protected routes (clears cookie, redirects to login). Approval routes still work (token auth is independent).

**Limitation:** Cache is per process; multi-instance deploys should use sticky sessions or a shared cache until Postgres + Redis.

## 4. Migration architecture

- **Layer 1:** `npx prisma migrate deploy` (SQL through Phase 2)
- **Layer 2:** `npm run db:migrate-phase3` … `phase7` (idempotent TS scripts)
- **Do not** use `db:push` in production
- **Validate:** `npm run db:validate`

## 5. Test coverage report

| Area | Tests |
|------|-------|
| Session cache | `tests/unit/session-version-cache.test.ts` |
| Public / approval routes | `tests/unit/public-routes.test.ts` |
| Token HMAC | `tests/unit/token-validator.test.ts` |
| RBAC | `tests/unit/permissions.test.ts` |
| Notification retries / DLQ | `tests/unit/notification-queue.test.ts` |
| Auth sessionVersion | `tests/unit/auth-session.test.ts` |
| Workflow + token consume + rollback | `tests/integration/workflow-tokens.test.ts` |

Run: `npm test`

## 6. Security hardening summary

- Transaction-safe approval consumption (replay + double-click via `updateMany` count)
- Timing-safe HMAC verification (existing, covered by tests)
- Logout invalidates server-side session version
- Cron routes unchanged (Bearer secret required)
- Teams sends only when webhook + settings enabled

## 7. Operational readiness

- README documents roles, migration order, workers, SSO, Teams
- `db:setup` one-command bootstrap
- `db:validate` preflight check
- Background jobs documented with npm scripts and API endpoints

## 8. PostgreSQL readiness

See [POSTGRESQL_READINESS.md](./POSTGRESQL_READINESS.md). No migration performed in this sprint.

## 9. Dead code cleanup

| Removed / fixed | Notes |
|-----------------|-------|
| `getAuditHistory` | Unused export removed |
| `resolveHrApprovers` | Unused function removed |
| `isTeamsIntegrationEnabled` `\|\| true` | Logic bug fixed |

## 10. Remaining production risks

| Risk | Mitigation path |
|------|-----------------|
| Session cache not shared across instances | Redis or DB version check on sensitive mutations (already on server actions) |
| Phase 3–7 TS migrations vs Prisma SQL | Consolidate into SQL migrations before Postgres |
| SQLite write contention | Postgres migration per readiness doc |
| `emitWorkflowNotification` inside workflow tx | Notifications still async queue; monitor duplicate enqueue edge cases |
| No E2E browser tests | Add Playwright for `/approve` + SSO smoke tests |
| Analytics RBAC helpers unused in UI | Wire or remove in a future cleanup pass |
