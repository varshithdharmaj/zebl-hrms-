# Integrations setup

## Microsoft Graph

- SSO, org sync, calendar sync modules under `src/lib/microsoft/`
- Env: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

## Teams

- Webhook URL in HR settings (`/admin/settings`)
- Toggle: `integration_settings.teams_enabled`
- Callback: `/api/integrations/teams/callback`

## Calendar sync

- `src/lib/calendar/` — maps approved leave to Outlook events
- Worker: `npm run integrations:process`

## Feature toggles

Configured in `/admin/settings` and stored in `integration_settings`.

## Health

- `GET /api/health` — liveness
- `GET /api/health/deep` — DB, config, Graph, queue depth
