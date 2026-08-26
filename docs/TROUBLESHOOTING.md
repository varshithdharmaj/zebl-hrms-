# Operational troubleshooting

## App won't start

1. Run `npm run db:validate`
2. Check `DATABASE_URL` is PostgreSQL (`config/validate.ts`)
3. `npx prisma generate` (stop dev server on Windows if EPERM)

## Session / login issues

- Verify `AUTH_SECRET` set
- After deploy, users may need re-login if session version bumped
- Microsoft SSO: confirm redirect URI matches Azure app registration

## Approvals fail

- Check leave `version` mismatch (concurrent edit)
- Review `WorkflowError` message in UI
- Admin: Operations page for stuck workflows

## Notifications not sending

```bash
npm run notifications:process
```

Check failed count in HR command center. Retry from `/admin/notifications`.

## Workers stuck

- Deep health: `/api/health/deep`
- Queue lock releases jobs after timeout (`queue-lock.ts`)
- Restart worker process; check `worker_heartbeats`

## Correlation IDs

API errors return `x-correlation-id`. Search server logs for JSON lines with matching `correlationId`.

## Tests

```bash
npm test
```

Integration tests need `DATABASE_URL` pointing at a test Postgres database.
