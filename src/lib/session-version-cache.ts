/**
 * In-process session version cache for Edge middleware.
 * Populated on successful server-side session resolution and invalidation.
 * For multi-instance deployments, pair with sticky sessions or a shared cache.
 */

const TTL_MS = 60_000;

type CacheEntry = {
  version: number;
  updatedAt: number;
};

const cache = new Map<string, CacheEntry>();

export function setCachedSessionVersion(userId: string, version: number): void {
  cache.set(userId, { version, updatedAt: Date.now() });
}

export function clearCachedSessionVersion(userId: string): void {
  cache.delete(userId);
}

/**
 * Returns true if JWT sessionVersion is stale, false if valid, null if unknown (cache miss/expired).
 */
export function isSessionVersionStale(
  userId: string,
  tokenVersion: number
): boolean | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.version !== tokenVersion;
}
