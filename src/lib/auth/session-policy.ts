const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
const DEFAULT_SESSION_MAX_HOURS = 12;

function readPositiveNumber(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Idle inactivity timeout, enforced against LoginSession.lastActivityAt. */
export const IDLE_TIMEOUT_MS =
  readPositiveNumber(process.env.AUTH_IDLE_TIMEOUT_MINUTES, DEFAULT_IDLE_TIMEOUT_MINUTES) * 60_000;

/** Absolute session lifetime, enforced via the session JWT's `exp` regardless of activity. */
export const SESSION_MAX_HOURS = readPositiveNumber(
  process.env.AUTH_SESSION_MAX_HOURS,
  DEFAULT_SESSION_MAX_HOURS
);

export const SESSION_MAX_LIFETIME_SECONDS = SESSION_MAX_HOURS * 60 * 60;
export const SESSION_MAX_LIFETIME_JWT = `${SESSION_MAX_HOURS}h`;
