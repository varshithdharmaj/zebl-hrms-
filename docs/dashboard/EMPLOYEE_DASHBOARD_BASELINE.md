# Employee Dashboard — Baseline Audit

**Scope:** `/employee/dashboard` only. Adjacent employee-shell features (Tickets, Login History, Active Sessions, Attendance detail page, Leaves) are noted only where they share a component or data function with the dashboard.

**Method:** every file below was read fresh from the repository for this audit — nothing here is carried over from prior work in this codebase. `git log`/`git status` were checked first to confirm the working tree is clean and to identify recent unrelated feature work (Helpdesk, Login History, Account Management) that landed elsewhere in the app but does not touch this route.

**No implementation code was changed to produce this document.**

---

## 1. Route and Page Entry Points

| Route | File | Access |
|---|---|---|
| `/employee/dashboard` | `src/app/(dashboard)/employee/dashboard/page.tsx` | Server Component. Redirects to `/login` if no session or no linked `employeeId`. |
| Shell wrapper | `src/app/(dashboard)/employee/layout.tsx` | Gates the whole `/employee/*` group via `canAccessEmployeeShell`; also runs one extra query (`prisma.employee.count({ where: { managerId } })`) purely to decide whether to show the "Team Approvals" nav item — unrelated to dashboard data but executes on every employee-shell page load, including this one. |

`page.tsx` reads four search params (`date`, `start`, `end`, `heatmapMonth`), passes them straight through as props to `EmployeeDashboard`, and wraps it in `<Suspense fallback={<PageSkeleton />}>`. No other logic lives in the page file — it is a thin auth+param-parsing shell.

---

## 2 & Component Dependency Map

```
EmployeeDashboardPage (server)
└─ EmployeeDashboard (server, async)
   ├─ DashboardWelcome (server)
   │  └─ DashboardToolbar (client) [layout="compact"]
   ├─ StatsGridSection (server)
   ├─ AttendanceTimeline (server)
   ├─ AttendanceHeatmap (client)
   ├─ HistorySection (server)
   │  └─ DashboardToolbar (client) [layout="inline", showDayPicker=false]  ← 2nd instance
   └─ DashboardWidgets (server)
```

### `EmployeeDashboard`
- **File:** `src/components/employee/employee-dashboard.tsx`
- **Purpose:** orchestrator. Fetches all data, computes two derived date labels, lays out the 2-column grid (`.hr-dashboard` / `.hr-dashboard__main` / `.hr-dashboard__rail`), passes slices of the fetched data down as props.
- **Data source:** 3 calls in one `Promise.all` — `getEmployeeDashboardData()`, `getLeaveBalanceSummaries()`, `getEmployeeAttendanceHeatmapData()`.
- **Props:** `employeeId, employeeName, selectedDate?, startDate?, endDate?, heatmapMonth?` (all from the page's search params).
- **State:** none (server component).
- **User interactions:** none directly — delegates to children.
- **Loading state:** none of its own; relies on the page's outer `<Suspense fallback={<PageSkeleton />}>` and the `AttendanceHeatmap`'s inner `<Suspense fallback={null}>`.
- **Error state:** none local — an unhandled throw (e.g. `getLeaveBalanceSummaries` throws `"Employee not found"` if the employee row is missing) propagates to the shared `src/app/(dashboard)/error.tsx` boundary.
- **Empty state:** none of its own — delegated to children.
- **Dependencies:** `@/lib/queries` (barrel re-export), `@/lib/leave`, `@/lib/attendance/heatmap-data`, `@/lib/utils`.
- **Duplicated elsewhere:** no — this exact orchestration shape exists only here.

### `DashboardWelcome`
- **File:** `src/components/employee/dashboard/dashboard-welcome.tsx`
- **Purpose:** greeting + today's status badge + the primary (compact-layout) date/range filter panel.
- **Data source:** props only.
- **Props:** `firstName, fullName, displayDate, dateIso, status, defaultDate, defaultStart, defaultEnd`.
- **State:** none (server component); greeting text is computed from `new Date().getHours()` at render time (server clock, not user-timezone-aware).
- **User interactions:** none directly — the embedded `DashboardToolbar` handles all interaction.
- **Loading state:** `<Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>` around the toolbar only.
- **Error/empty state:** none — nothing here can be empty (status always has a value, defaulting to `"No Record"` upstream).
- **Dependencies:** `StatusBadge`, `DashboardToolbar`.
- **Duplicated elsewhere:** the KPI row that used to live here was already removed in a prior pass — confirmed absent in the current file (only greeting + `StatusBadge` + toolbar remain, no numeric stats).

### `StatsGridSection`
- **File:** `src/components/employee/dashboard/stats-grid-section.tsx`
- **Purpose:** the canonical 5-tile KPI row — today worked, present days, overtime, short-hours count, leave balance (EL/CL/SL inline list in the 5th tile).
- **Data source:** props only (`workedMinutes, presentDays, overtimeMinutes, shortHoursCount, rangeLabel, balances`).
- **Props/State:** no internal state; pure presentational, derives `el`/`cl`/`sl` via `.find()` on the `balances` array each render.
- **User interactions:** none.
- **Loading/Error/Empty:** none — all values default via upstream `?? 0` / empty array; there is no explicit "no data yet" message if `balances` is `[]` (the leave-balance list would simply render nothing under the 5th tile's label).
- **Dependencies:** `DashboardCard`, `StatsGrid` (both `src/components/ui/*`).
- **Duplicated elsewhere:** `/employee/attendance` (`EmployeeAttendanceView`) renders its own 4-tile `StatsGrid` with overlapping metrics (present days, short hours, overtime, attendance rate) computed by a **separate** function (`getEmployeeAttendanceSummary`) over a **separate** query — same shape of number, independently fetched and independently reduced. This is the one confirmed cross-page duplication left in the codebase (see §9).

### `AttendanceTimeline`
- **File:** `src/components/employee/attendance-timeline.tsx`
- **Purpose:** "today's attendance" as a 4-step visual (check-in / check-out / worked / overtime), desktop horizontal / mobile vertical layouts.
- **Data source:** props (`checkIn, checkOut, workedMinutes, overtimeMinutes, status, selectedDateLabel?`).
- **State:** none.
- **User interactions:** none (purely informational).
- **Loading state:** none.
- **Empty state:** explicit — `hasNoRecord = status === "No Record"` renders an `EmptyState` ("No attendance record for this day") and suppresses the step grid entirely.
- **Error state:** none needed (no fetch of its own).
- **Dependencies:** `StatusBadge`, `SectionCard`, `EmptyState`.
- **Duplicated elsewhere:** no.

### `AttendanceHeatmap`
- **File:** `src/components/employee/dashboard/attendance-heatmap.tsx` — `"use client"`
- **Purpose:** calendar-grid visualization of the selected month's attendance-day classification (Present/Absent/Holiday/Leave/Weekly-off/Worked-on-off-day/Insufficient-data), with a working-hour intensity ramp on worked days.
- **Data source:** prop `month: AttendanceHeatmapMonth` (pre-computed server-side by `getEmployeeAttendanceHeatmapData`).
- **State:** none in React state — month navigation is fully URL-driven (`useSearchParams()` read, `<Link>` to a new `?heatmapMonth=` value triggers a server round-trip, not a client re-fetch).
- **User interactions:** prev/next month links; hover/focus per cell reveals a tooltip (CSS `group-hover`/`group-focus-within`, no JS state).
- **Loading state:** wrapped by the parent in `<Suspense fallback={null}>` — **no visible fallback UI** (blank until resolved) — the only spot in the dashboard tree with a genuinely empty (not skeleton) loading fallback.
- **Empty/Error state:** no explicit "no data this month" message — an all-`"No data"`-gray grid is possible (e.g., a brand-new employee with no attendance history) and looks identical to a loading glitch; there is no error boundary specific to this component.
- **Dependencies:** `SectionCard`, `@/lib/attendance/day-classification` (types only), `@/lib/attendance/heatmap-data` (types only), `@/lib/utils`.
- **Duplicated elsewhere:** no.

### `HistorySection`
- **File:** `src/components/employee/dashboard/history-section.tsx`
- **Purpose:** recent-attendance table (up to `RANGE_RECORD_LIMIT` rows, newest first) with a second, differently-configured `DashboardToolbar` instance and a "Full history" link to `/employee/attendance`.
- **Data source:** props (`rangeLabel, records, defaultDate, defaultStart, defaultEnd`) — `records` is `data.recentRecords`, itself `[...periodRecords].reverse().slice(0, RANGE_RECORD_LIMIT)` computed in the data layer, not re-fetched here.
- **State:** none of its own (delegates to the embedded toolbar).
- **User interactions:** the embedded toolbar (date-range only, day-picker hidden); "Full history" link.
- **Loading state:** `<Suspense fallback={null}>` around its toolbar instance (also blank, not skeleton).
- **Empty state:** explicit `EmptyState` ("No records in this range") when `records.length === 0`.
- **Error state:** none of its own.
- **Dependencies:** `SectionCard`, `DataTable`/`DataTableRow`/`DataTableCell`, `StatusBadge`, `EmptyState`, `Button`, `DashboardToolbar`.
- **Duplicated elsewhere:** the underlying `DataTable` columns/row-shape are near-identical to the table in `EmployeeAttendanceView` (`/employee/attendance`) — same six columns, same `StatusBadge` usage, different data source (`getEmployeeAttendanceHistory`, paginated, vs. this component's un-paginated slice of `periodRecords`). Two independent render implementations of the same table shape.

### `DashboardWidgets`
- **File:** `src/components/employee/dashboard/dashboard-widgets.tsx`
- **Purpose:** rail content — leave-balance list (EL/CL/SL with "Request leave" CTA) + a static "Keep it up" motivational card linking to `/employee/attendance`.
- **Data source:** props (`balances, employeeName`) — same `balances` array already used by `StatsGridSection`.
- **State:** none.
- **User interactions:** two `Link`-wrapped buttons (`/employee/leaves`, `/employee/attendance`).
- **Loading/Error state:** none.
- **Empty state:** none explicit if `balances` is empty (renders an empty `<ul>`).
- **Dependencies:** `WidgetCard`, `Button`.
- **Duplicated elsewhere:** the leave-balance numbers (EL/CL/SL remaining) are the **same three values** already shown in `StatsGridSection`'s 5th tile — same array, two separate renderings (a compact inline list here in the widget, vs. a compact inline list there too — nearly identical presentation in two different components on the same page). This is a live, confirmed visual duplication, not yet resolved.

### `DashboardToolbar` (client, 2 instances per page load)
- **File:** `src/components/employee/dashboard-toolbar.tsx` — `"use client"`
- **Purpose:** the single date/range-filter control, reused with different `layout`/`showDayPicker`/`showRange` props in two places (`DashboardWelcome`'s compact panel, `HistorySection`'s inline action row).
- **Data source:** reads `useSearchParams()` for current `date`/`start`/`end`; ships 3 quick-range presets computed client-side (`getPresets()`: this month / last 7 days / last 30 days) from `new Date()` at render time.
- **State (real React state, the only client state in the whole dashboard tree):** `viewOpen`, `filtersOpen` (popover visibility), `rangeDraftStart`/`rangeDraftEnd` (uncommitted range-picker inputs, synced back to the applied range via a `useEffect` on `filtersOpen`).
- **User interactions:** "View" popover (today / pick a day / quick-range presets), "Advanced filters" popover on desktop / bottom `Sheet` on mobile (custom start/end date inputs, Apply/Reset), an "Escape" key handler closes both popovers, a "clear custom range" chip when a non-default/non-preset range is active.
- **Loading/Error/Empty state:** none — it's a pure controller, no data of its own.
- **Dependencies:** `Button`, `Sheet`, `cn`/`formatDate`/`startOfDay`/`startOfMonth`/`toISODate` from `@/lib/utils`.
- **Duplicated elsewhere:** also used by `EmployeeAttendanceView` (`/employee/attendance`) with `showDayPicker={false}` — this is **intentional reuse**, not duplication; it's the one component in this tree that is already correctly shared rather than copy-pasted.

---

## 3. Data-Fetching Functions, Server Actions, Prisma Queries

No API routes and no client-side hooks (`useEffect`+`fetch`, SWR, React Query) are involved anywhere in this tree — everything is server-rendered via three data-layer functions called once at the top of `EmployeeDashboard`, all read-only (no server actions/mutations happen on this page).

| Function | File | Prisma calls | Notes |
|---|---|---|---|
| `getEmployeeDashboardData()` | `src/lib/data/attendance.ts` (re-exported via `src/lib/queries.ts`) | 2: `attendanceRecord.findFirst` (selected day) + `attendanceRecord.findMany` (range, unbounded by any `take`) | Aggregation delegated to the shared pure helper `aggregateAttendanceForRange()` (`src/lib/attendance/aggregate-range.ts`) — already deduplicated against `getEmployeeAttendanceSummary`'s identical reduction logic in an earlier pass. |
| `getLeaveBalanceSummaries(employeeId, { processAccruals: false })` | `src/lib/leave.ts` | 4 in the steady state: `employee.findUnique`, `employeeLeaveBalance.findUnique` (via `getOrCreateLeaveBalanceRow`), `leaveTransaction.groupBy`, `leaveTransaction.findMany` (manual adjustments) | `processAccruals: false` on this page skips an additional `processPendingLeaveAccruals()` call that the accrual-processing path would otherwise trigger. |
| `getEmployeeAttendanceHeatmapData(employeeId, heatmapMonth)` | `src/lib/attendance/heatmap-data.ts` | 5, all in one `Promise.all`: `attendanceRecord.findMany` (month range) + `getHolidaysForRange()` + `getApprovedLeaveForEmployeeRange()` + `getAttendanceSettings()` (React-`cache()`-memoized singleton) + `getDateOverridesForRange()` | Per-day classification (`getEffectiveAttendanceDayType()`) runs in a JS loop over the 5 already-fetched arrays — confirmed no per-day query. |

**Total: 11 Prisma round-trips per dashboard page load**, issued as 3 parallel top-level awaits (`Promise.all` in `EmployeeDashboard`) that internally fan out to the 2/4/5 above. No N+1 pattern found anywhere in this path.

`prisma` client itself: `src/lib/prisma.ts` (the file open in your editor) — standard singleton-with-global-caching pattern, unrelated to dashboard-specific logic.

---

## 4. Current State Management

- **No client-side global state** (no Context, Zustand, Redux, React Query cache) touches this route.
- **All "state" is either server-rendered props or URL search params.** The only real `useState` in the tree lives in `DashboardToolbar` (popover open/closed, draft range inputs) — and even that is reconciled back to the URL on every meaningful action (`router.push`), not persisted as standalone client state across navigations.
- Two independent `DashboardToolbar` instances render on the same page (Welcome panel + History section action row) — each holds its **own** local `viewOpen`/`filtersOpen`/draft-range state, but both read/write the **same** URL params, so they stay in sync with each other only through the URL, not directly.

---

## 5. URL / Search-Parameter Behavior

| Param | Set by | Consumed by | Effect |
|---|---|---|---|
| `date` | `DashboardToolbar` "View day" picker | `getEmployeeDashboardData()` (selected single day) | Also clears `page` if present (toolbar's `push()` helper). |
| `start`, `end` | `DashboardToolbar` presets/custom range | `getEmployeeDashboardData()` (range aggregation, chart/history source array) | Setting a range clears `date`. |
| `heatmapMonth` | `AttendanceHeatmap` prev/next `<Link>` | `getEmployeeAttendanceHeatmapData()` | Fully independent of `date`/`start`/`end` — by design, so month navigation doesn't disturb the rest of the page's selected range. |

All param changes trigger a full server round-trip (`router.push` in the toolbar, plain `<Link>` in the heatmap) — there is no client-side re-fetch/transition state (no `useTransition`/`isPending` anywhere in this tree), so every filter change re-renders the whole page server-side.

---

## 6. Loading, Error, and Empty States — Summary Table

| Component | Loading | Error | Empty |
|---|---|---|---|
| Route (`(dashboard)` group) | `src/app/(dashboard)/loading.tsx` → `PageSkeleton` (Next.js route-level boundary, shown during server navigation) | `src/app/(dashboard)/error.tsx` (shared with `/admin/*`; generic "something went wrong" + Try again / Back to login) | n/a |
| `page.tsx` (author-added) | `<Suspense fallback={<PageSkeleton />}>` around `EmployeeDashboard` | inherits the group boundary above | n/a |
| `EmployeeDashboard` | none of its own | none of its own | none of its own |
| `DashboardWelcome` | inline skeleton div around its toolbar | — | — |
| `AttendanceTimeline` | — | — | explicit `EmptyState` |
| `AttendanceHeatmap` | `<Suspense fallback={null}>` (**blank**, not a skeleton) | none | none (an all-gray month is indistinguishable from "still loading") |
| `HistorySection` | `<Suspense fallback={null}>` (**blank**) around its toolbar only | — | explicit `EmptyState` |
| `StatsGridSection` / `DashboardWidgets` | — | — | none (silently renders zeros/empty list) |

**Key gap confirmed by this audit:** there is no dashboard-specific `error.tsx`/`loading.tsx` — both are inherited from the shared `(dashboard)` route group, which also serves `/admin/*`. The shared error message ("...or sign out and back in") is generic enough to be inoffensive for an employee context, but it was not written with this page in mind.

---

## 7. Existing Tests

**None.** A repo-wide search for any of the dashboard component/file names (`employee-dashboard`, `dashboard-welcome`, `stats-grid-section`, `attendance-heatmap`, `dashboard-widgets`, `history-section`, `dashboard-toolbar`) inside `tests/` returns zero matches. The only attendance-related tests that exist (`tests/unit/attendance-day-classification.test.ts`, `tests/unit/attendance-schedule-resolver.test.ts`) cover the **data-layer classification logic** the heatmap consumes, not any dashboard component's rendering, props, or interaction behavior.

---

## 8. Current Responsive Behavior

- **Overall grid** (`.hr-dashboard` class, `src/app/globals.css`): single column by default; `@media (min-width: 1280px)` (Tailwind `xl`) switches to `grid-template-columns: minmax(0,1fr) 19.5rem` (main content + fixed-width rail). Below `xl`, the rail (`DashboardWidgets`) stacks beneath the main column.
- **`DashboardWelcome`**: `flex-col` below `xl`, `flex-row` at `xl:` — the filter panel is full-width above the greeting on narrow screens, side-by-side at `xl`.
- **`StatsGridSection`** (via `StatsGrid`/`DashboardCard` — not re-audited in full here since they're generic, unmodified UI primitives): standard `sm:grid-cols-2 lg:grid-cols-4`-style responsive grid pattern used throughout the app.
- **`AttendanceTimeline`**: two entirely separate markup blocks — `hidden md:block` (4-column horizontal step grid with a connecting line) and a `md:hidden` vertical `<ul>` — not a single responsive layout, a true two-implementation split gated by breakpoint.
- **`AttendanceHeatmap`**: fixed `grid-cols-7` at all breakpoints; cell size does not scale down for small screens (no mobile-specific layout), only the surrounding `SectionCard`/page width changes. Legend row uses `flex-wrap`.
- **`DashboardToolbar`**: explicit mobile/desktop split for the "Advanced filters" trigger — a popover on `sm:` and above, a bottom `Sheet` below `sm:`.

---

## 9. Current Performance Characteristics

- **11 Prisma queries per page load** (§3), zero N+1, all range-bounded — no per-day loops found anywhere in this path (heatmap classification runs in-memory over pre-fetched arrays).
- **`periodRecords` is unbounded** (`getEmployeeDashboardData`'s range `findMany` has no `take`) — for an employee with a very wide custom date range (the toolbar allows an arbitrary custom start/end), this could return an unbounded number of rows; `recentRecords` then slices only the first `RANGE_RECORD_LIMIT` of it, meaning the full unbounded set is still fetched into memory before being trimmed.
- **Confirmed duplication surviving from the prior cleanup pass** (§2 details above): `StatsGridSection` vs. `DashboardWidgets` render the same three leave-balance numbers from the same array; `EmployeeAttendanceView` (a different route) independently re-fetches and re-aggregates attendance totals that overlap in shape (not value, since date ranges may differ) with this page's `StatsGridSection`.
- **`getAttendanceSettings()`** is `React.cache()`-memoized, so if it's also called elsewhere in the same request (it isn't, on this route, today) it would dedupe automatically — noted for awareness, not a current problem.
- No client-side data fetching exists to characterize (no waterfall risk beyond the one `Promise.all` at the top of `EmployeeDashboard`).

---

## 10. Layout / Screenshot Baseline

A pixel screenshot could not be captured for this baseline: the app requires an authenticated employee session, and per your earlier instruction the database seed/bootstrap scripts have not been run against Supabase yet, so no employee login currently exists to screenshot behind. The structural layout below is derived directly from the CSS/JSX read in this audit, not a rendered capture.

```
┌─────────────────────────────────────────────────────────────┐
│ DashboardWelcome                                             │
│  greeting + name · status badge      │  Filters panel        │
├───────────────────────────────────────┴───────────────────────┤
│ StatsGridSection (5 tiles: worked / present / OT / short / EL,CL,SL) │
├─────────────────────────────────┬─────────────────────────────┤
│ AttendanceTimeline (today)      │ AttendanceHeatmap (month)   │  ← xl:grid-cols split (hr-dashboard__analytics)
├─────────────────────────────────┴─────────────────────────────┤
│ HistorySection (recent attendance table)                      │
└─────────────────────────────────────────────────────────────┬─┘
                                                                │
                                         ┌──────────────────────┘
                                         │ DashboardWidgets (rail)
                                         │  leave balances · CTA card
                                         └────────────────────────
```
Rail collapses beneath the main column below `xl` (1280px); everything above stacks to single-column below `md`/`sm` per §8.

**Recommendation:** capture a real screenshot via the `run` skill once `db:seed`/`db:bootstrap-admin` have been executed and a real employee login exists — flagging this as a follow-up rather than fabricating one now.

---

## Prioritized Implementation Checklist

*No phase list was provided alongside this request, so this checklist is derived directly from the gaps this audit surfaced — ordered by risk/impact, not by any external phase plan. Confirm priority before acting on it.*

1. **Add dashboard component tests** (§7) — zero coverage today on the highest-traffic employee-facing page in the app. Start with `AttendanceHeatmap`'s cell-classification-to-visual mapping and `DashboardToolbar`'s URL-param read/write logic, since both have real branching logic, unlike the purely presentational components.
2. **Resolve the leave-balance duplication** between `StatsGridSection` and `DashboardWidgets` (§2, §9) — same three numbers, two renderings, one page.
3. **Give `AttendanceHeatmap` a real loading and empty state** (§2, §6) — currently blank-on-load and indistinguishable-when-genuinely-empty; both are UX gaps for new employees or slow connections.
4. **Bound `periodRecords`** (§9) — add a `take`/pagination ceiling to the range query so a wide custom date range can't pull an unbounded row set into memory.
5. **Decide whether the cross-page duplication with `/employee/attendance`** (`EmployeeAttendanceView`'s stats + table vs. this page's `StatsGridSection`/`HistorySection`) is worth consolidating into one shared component/query, or is acceptable as intentionally-separate "overview vs. detail" views — this is a product judgment call, not purely technical.
6. **Consider a dashboard-specific `error.tsx`** if the generic shared `(dashboard)/error.tsx` message ever needs to differ for employee vs. admin context — currently low priority since the shared message is inoffensive here.
