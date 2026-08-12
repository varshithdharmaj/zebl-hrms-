/** Default connections per Node process (one ECS task). */
export const DEFAULT_DATABASE_POOL_MAX = 5;
/** Hard cap so a mis-set env cannot open hundreds of sockets per task. */
export const MAX_DATABASE_POOL_MAX = 20;

export function resolveDatabasePoolMax(
  raw: string | undefined = process.env.DATABASE_POOL_MAX
): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DATABASE_POOL_MAX;
  return Math.min(MAX_DATABASE_POOL_MAX, Math.floor(n));
}

/** Transaction-mode PgBouncer / Neon pooler — connections must not be reused. */
export function usesPgBouncer(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("pgbouncer=true")) return true;
  try {
    const parsed = new URL(url);
    return parsed.port === "6543";
  } catch {
    return /:6543(?:\/|\?|$)/.test(lower);
  }
}
