# P2 UX & HR operations polish — deliverables

## 1. UX optimization summary

P2 focused on **workflow friction reduction** and **action-oriented HR UI** without new infrastructure or integrations.

| Area | Change |
|------|--------|
| Manager approvals | Table inbox, bulk approve, preview drawer, SLA bars, overlap warnings, sort |
| Admin dashboard | HR command center (risks, staffing, conflicts) |
| Global search | ⌘K command palette, role-scoped API |
| Leave calendar | `/admin/calendar` with department filters + holidays |
| Admin leaves | URL filters (status, search) via `TableToolbar` |
| Employee leaves | Upcoming holidays, balance planning hint |
| Employee profile | Overview tab (hierarchy, ops stats) |
| Notifications | In-app notification center (actionable links) |
| Settings | `/admin/settings` for escalation + integration toggles |
| Shell | Top bar search + notifications (desktop + mobile) |

## 2. Approval workflow UX

- **Table-first inbox** replaces card stack — faster scanning.
- **Bulk approve** (max 25) with audit log `bulk_operation`.
- **Preview drawer** (`Sheet`) — timeline, balances, overlap warnings without navigation.
- **SLA progress** from `integration_settings.escalation_hours`.
- **Overlap detection** (`leave-overlap.ts`) — team + employee conflicts flagged.
- **Sort** by submitted date, start date, days, SLA urgency.

## 3. Global search architecture

```
User ⌘K → GlobalCommandPalette (client)
         → GET /api/search?q=
         → globalSearch(session) in src/lib/search/global-search.ts
         → employees / leaves / audit (admin) / quick pages
```

Role-scoped: managers see team leaves; employees see self; admins see full set.

## 4. HR operations dashboard

`HrCommandCenterView` replaces vanity stats dashboard:

- Pending HR approvals & escalation risk
- Absent today & on-leave today
- Leave conflicts in queue
- Short-staffed departments
- Failed notifications + Graph health alerts
- Deep links to leaves, calendar, operations, settings

Data: `src/lib/hr/command-center.ts`

## 5. Calendar UX

- `/admin/calendar` — list view for current + next month
- Department filter chips
- Holiday chips from `holidays` table
- Approved + pending approval overlays
- Lib: `src/lib/leave/leave-calendar.ts`

## 6. Bulk operation safety

- **Max 25** items per bulk approve batch
- Per-item try/catch — partial success reported
- **Audit log** with `operation: bulk_approve` metadata
- **Version** required per row (optimistic concurrency preserved)
- Bulk manager assign with circular-chain detection (`bulkAssignManagerAction`)

## 7. Mobile responsiveness

- Approval table `overflow-x-auto` horizontal scroll
- Sticky mobile top bar (search + notifications)
- Drawer preview full-height on small screens
- Touch-friendly checkbox + action targets

## 8. Accessibility

- Sheet: `role="dialog"`, `aria-modal`, Escape to close
- Command palette: arrow navigation, `aria-selected`
- Table toolbar: labeled selects and search input
- Focus trap on drawer open

## 9. Performance UX

- Server-side leave filtering (reduces client table size)
- Debounced search (200ms) in command palette
- Notification center fetched on open (not every page load)
- Parallel data fetching on approvals page (`Promise.all`)

## 10. Remaining UX pain points

| Pain point | Notes |
|------------|--------|
| Bulk reject UI | Action exists; inbox UI not wired yet |
| Visual month grid calendar | List view only; grid is future enhancement |
| Saved filter presets | URL params only; no named saved views |
| Real-time notification push | Poll on open; no WebSocket |
| Manager team calendar | Admin calendar only; manager-scoped view TODO |
| Optimistic UI on approve | Full page revalidate; no inline optimistic row removal |
