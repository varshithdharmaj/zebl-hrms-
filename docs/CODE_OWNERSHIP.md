# Module ownership & boundaries

Prevents architectural drift. When changing a module, stay within its boundary.

| Module | Owns | Must not own |
|--------|------|----------------|
| `lib/workflow/` | Leave state machine, steps, SLA helpers | UI, direct email send |
| `lib/notifications/` | Queue, dispatch, channels | Workflow business rules |
| `lib/integrations/` | Job queue, Graph sync orchestration | Leave balances |
| `lib/data/` | Read-only Prisma aggregations | Mutations |
| `lib/auth/` | Login providers, cookies, OAuth | Employee CRUD |
| `lib/approval-tokens/` | Token lifecycle | Workflow transitions |
| `lib/analytics/` | Reporting jobs, insights | Core attendance writes |
| `actions/` | Form mutations, revalidation | Complex query logic |
| `components/` | Presentation | Database access |
| `app/api/` | HTTP contracts | Duplicated workflow logic |

## Workflow ownership

All leave status changes go through `leave-workflow.ts`. Do not update `workflow_status` directly except migration/repair tools.

## Integration ownership

External API calls live in `lib/microsoft/`, `lib/calendar/`, `lib/notifications/channels/`. Toggle via `integration_settings` only.

## Audit ownership

`lib/audit.ts` — `writeAuditLog` for admin, bulk, and sensitive employee changes.

## Config ownership

`lib/config/` — env access and startup validation. Feature flags in DB (`integration_settings`), not scattered `process.env` checks in UI.
