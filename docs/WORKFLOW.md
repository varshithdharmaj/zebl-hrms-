# Leave workflow engine

## States

`submitted` → `pending_approval` → `approved` | `rejected` | `withdrawn` | `cancelled`

Labels and helpers: `src/lib/workflow/workflow-status.ts`.

## Core module

`src/lib/workflow/leave-workflow.ts`

- `advanceWorkflow` — manager/HR approval step
- `rejectWorkflow` — requires minimum comment length
- `withdrawWorkflow` / `cancelWorkflow` — employee/admin paths
- `WorkflowError` — business rule failures

## Approval steps

Multi-step chain stored in `leave_approval_steps`. Current step on `leave_requests.current_step_id`.

## Tokens (email/Teams links)

`src/lib/approval-tokens/` — single-use tokens, transactional consume (`token-consumer.ts`).

## SLA & escalation

- Escalation hours from `integration_settings` (HR settings UI).
- SLA display: `workflow-sla.ts`, `workflow-progress-bar.tsx`.

## Notifications

Hooks in `workflow/notification-hooks.ts` enqueue email/Teams on state changes.

## Bulk operations

`actions/bulk-workflow.ts` — validated batches (max 25), audit logged.

## Integrity

`workflow-integrity.ts` — admin repair utilities; see Operations page.
