# Notification architecture

## Channels

- **Email** — React Email templates in `src/emails/`
- **Teams** — webhook channel when enabled (`teams-channel.ts`)

## Queue

`notification_queue` table processed by:

```bash
npm run notifications:process
```

Locking: `src/lib/db/queue-lock.ts` (`FOR UPDATE SKIP LOCKED`).

## Dispatcher

`src/lib/notifications/notification-dispatcher.ts` — routes events to channels per preferences.

## UI

- Admin: `/admin/notifications` — retry, stats (`admin-queries.ts`)
- Users: notification center (`GET /api/notifications/center`)

## Preferences

Per-user channel toggles; forms in employee/manager settings.

## Failure handling

Failed rows visible in HR command center and operations dashboard. Retry via admin actions.
