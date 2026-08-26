# P3 Maintainability & technical debt — deliverables

## 1. Technical debt cleanup report

| Area | Action |
|------|--------|
| Dead UI | Removed `admin-dashboard-view.tsx`, `employee-page-header.tsx`, `month-filter.tsx` |
| Dead lib | Removed `accent-colors.ts`, `getAdminDashboardStats` |
| Query sprawl | Centralized reads under `src/lib/data/` |
| Error inconsistency | `AppError` + `withAuthenticatedApi` on search/notification APIs |
| Unsafe JSON | Bulk actions use Zod validation |
| Action types | Shared `actions/types.ts` |
| Duplicate API errors | `leave-api.ts` delegates to `apiErrorResponse` |

## 2. Dead code removal summary

**Deleted files (4):**

- `src/components/admin/admin-dashboard-view.tsx`
- `src/components/employee/employee-page-header.tsx`
- `src/components/ui/month-filter.tsx`
- `src/lib/accent-colors.ts`

**Removed exports:** `getAdminDashboardStats` (only used by deleted dashboard).

**Migrated:** `EmployeeAttendanceView` → `WorkspacePageHeader` directly.

## 3. Architecture standardization explanation

Normalized layers:

| Layer | Path |
|-------|------|
| Data access (reads) | `src/lib/data/*` |
| Validation | `src/lib/validation/*` (Zod) |
| Errors | `src/lib/errors/*` |
| Domain services | `lib/workflow`, `lib/notifications`, etc. |
| Mutations | `src/actions/*` |
| UI | `src/components/*` |

`src/lib/queries.ts` is a **deprecated barrel** re-exporting `@/lib/data` for backward compatibility.

Boundaries documented in [CODE_OWNERSHIP.md](./CODE_OWNERSHIP.md).

## 4. Query layer refactor explanation

```
src/lib/data/
├── constants.ts    # PAGE_SIZE, RANGE_RECORD_LIMIT
├── attendance.ts   # dashboard, summary, history, admin records
├── employees.ts    # list + profile fetch
├── leaves.ts       # leave requests + employee leave page
├── dashboard.ts    # manager stats
└── index.ts        # public exports
```

Domain-specific reads remain in place (`audit-queries`, `command-center`, `ops-queries`) where aggregation logic is domain-specific.

## 5. Documentation overhaul summary

**New docs:**

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AUTH.md](./AUTH.md)
- [WORKFLOW.md](./WORKFLOW.md)
- [NOTIFICATIONS.md](./NOTIFICATIONS.md)
- [DATABASE.md](./DATABASE.md)
- [INTEGRATIONS.md](./INTEGRATIONS.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OWNERSHIP.md](./CODE_OWNERSHIP.md)

Existing phase docs (P0–P2, DEPLOYMENT, MIGRATIONS) retained.

## 6. Dependency audit report

`npm audit` (May 2026):

| Package | Severity | Notes |
|---------|----------|-------|
| `postcss` (via `next`) | Moderate | Transitive; fix may require Next major — monitor upstream |
| `xlsx` | High | Used for attendance Excel import; no fix available — validate uploads, consider sandboxing |

**Added:** `zod` for validation (minimal, maintained).

**Not removed:** `xlsx` — required for attendance upload; document risk in operations.

## 7. Developer tooling improvements

| Tool | Change |
|------|--------|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate` | typecheck + lint + test |
| Tests | `tests/fixtures/`, `tests/helpers/`, validation unit test |
| CONTRIBUTING.md | Pre-commit setup instructions |

Optional: run `npx husky init` locally per CONTRIBUTING guide.

## 8. Design system consistency summary

- `src/lib/design/tokens.ts` — spacing, typography, workflow variant map
- `WorkflowStatusBadge` — uses `displayStatusLabel` + `StatusBadge`
- Existing `StatusBadge`, `TableToolbar`, `WorkflowProgressBar` remain canonical

## 9. Maintainability improvements summary

- Predictable import path for reads (`@/lib/data`)
- Correlation IDs on standardized API routes
- Structured JSON logging via `logger` (unchanged, documented)
- Zod schemas for bulk operations (extensible pattern)
- 31 unit tests (+3 validation tests)

## 10. Remaining long-term risks

| Risk | Mitigation path |
|------|-----------------|
| Prisma in some components | Move to data layer incrementally |
| `xlsx` vulnerabilities | Replace with maintained fork or server-side-only parsing |
| ActionState still duplicated in some action files | Migrate imports to `actions/types.ts` |
| Leave API routes not on `withAuthenticatedApi` | Migrate remaining routes |
| No E2E tests | Add Playwright when stable |
| Saved filter presets | P2 backlog |
| Husky not installed by default | Team runs `husky init` per CONTRIBUTING |
