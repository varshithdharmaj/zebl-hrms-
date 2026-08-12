# Authenticated HTTP load test plan

Do **not** treat isolated `tsx` loader timings or unauthenticated 307 redirects as application TTFB.

## Prerequisites

- Staging ECS + RDS (not local `npm run dev`)
- A real session cookie from an HR user that does **not** have `mustChangePassword`
- `ZEBL_PERF_TIMING=1` on the task if you want `"message":"timing"` logs
- CloudWatch metrics: ECS CPU/memory, RDS `DatabaseConnections`, ALB target response time

## Stages

Run each stage for 3–5 minutes. Stop if error rate > 2% or p95 > 5s on interactive pages.

| Stage | Concurrent sessions | Notes |
|-------|---------------------|--------|
| 1 | 2 | Smoke |
| 2 | 5 | HR pilot shape |
| 3 | 10 | |
| 4 | 25 | First serious concurrency |
| 5 | 50 | Watch RDS connections vs `tasks × DATABASE_POOL_MAX` |
| 6 | 100 | Only after 50 is stable |

## Routes (authenticated)

1. `GET /admin/dashboard`
2. `GET /admin/attendance` (or current attendance list path)
3. `GET /admin/leaves`
4. `GET /admin/recruitment` (pipeline)
5. `GET /admin/recruitment/candidates`
6. `GET /admin/recruitment/candidates/{id}` (workspace overview)
7. `GET /admin/recruitment/candidates/{id}?tab=applications`
8. Leave approval action (low rate — mutations)

## Capture

- requests/sec, p50, p95, p99, error rate
- ECS CPU / memory / restarts
- RDS connections, CPU, query latency
- Application logs: pool errors, 5xx, `Password change required`

## Cookie capture

Log in via the browser, copy `zebl_session`, then:

```bash
export ZEBL_SESSION_COOKIE='zebl_session=...'
export BASE_URL='https://ams-staging.example.com'
node scripts/load-test/authenticated-smoke.mjs
```

That smoke script is a **single-session sequential probe**, not a 100-user load test.
Use k6/artillery against staging for stages 2–6 (not bundled as a dependency).

## Pass criteria (staging)

- p95 interactive pages < 2s excluding AI/PDF/import (matches PILOT_ROLLOUT.md)
- 5xx < 2%
- RDS connections stay below `max_connections - 20` headroom
- No task OOM / restart loop
