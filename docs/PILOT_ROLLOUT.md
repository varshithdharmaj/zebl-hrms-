# ZEBL_AMS — Controlled Pilot Rollout

Use this after staging is green. Do **not** expose all 150–200 employees on day one.

## Go / No-Go (before any real employees)

- [ ] CI green: lint, app `tsc`, tests (critical), `npm run build`
- [ ] Staging ≠ production (DB, secrets, SSO, email, S3)
- [ ] `prisma migrate deploy` succeeded; backup taken first
- [ ] RDS automated backup + **one restore tested**
- [ ] `RECRUITMENT_STORAGE_DRIVER=s3` and document upload/download works
- [ ] EventBridge cron running; test email delivered (SES)
- [ ] `AUTH_SSO_AUTO_LINK=false` (or written risk acceptance)
- [ ] Logout bumps `sessionVersion` (Edge rejects old JWT)
- [ ] `/api/health` green on ALB
- [ ] Smoke: login, attendance, leave, candidate→offer→convert
- [ ] Rollback plan documented
- [ ] On-call knows CloudWatch log group + deep health

## Rollout stages

### Stage 1 — Developer / staging soak (2–5 days)

- Full smoke suite daily
- Watch timing logs for dashboard / lists (`recruitment.dashboard.load`)
- Fix any P0 defects before Stage 2

### Stage 2 — HR / Admin pilot (2–5 users, 1 week)

- HR creates candidates, moves pipeline, creates offers
- Confirm document storage and conversion preview
- Confirm approval emails and notification queue drain

### Stage 3 — Employee pilot (5–10 employees)

- Attendance + leave only (recruitment optional)
- Collect UX and performance feedback
- Abort criteria: data corruption, auth bypass, >5% 5xx on critical paths

### Stage 4 — Expanded pilot (30–50 employees)

- Enable manager approvals at scale
- Re-check RDS CPU / connections and ALB latency p95
- Confirm backups still running

### Stage 5 — Broad rollout (150–200)

- Communicate cutover window
- Keep previous ECS revision for instant rollback
- Monitor first 3 business days closely

## Abort / rollback triggers

- Authentication or authorization failure affecting multiple users
- Attendance/leave incorrect balances
- Recruitment documents missing or wrong tenant access
- Sustained 5xx > 2% on login / attendance / leave
- Email backlog growing without drain

## Success criteria for broad rollout

- p95 interactive pages &lt; 2s for common HRMS ops (excluding AI/PDF/import)
- Zero open P0 security items
- Notification queue not stuck &gt; 15 minutes
- Documented restore still valid within retention window
