/**
 * In-memory preview cache — parse once, confirm reuses rows.
 * Single-process TTL store (no schema). Entries are scoped by userId.
 */

import type { AttendancePreviewCacheEntry } from "./preview-types";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 50;

type GlobalCache = {
  __amsAttendancePreviewCache?: Map<string, AttendancePreviewCacheEntry>;
};

function store(): Map<string, AttendancePreviewCacheEntry> {
  const g = globalThis as typeof globalThis & GlobalCache;
  if (!g.__amsAttendancePreviewCache) {
    g.__amsAttendancePreviewCache = new Map();
  }
  return g.__amsAttendancePreviewCache;
}

function purgeExpired(now = Date.now()): void {
  const map = store();
  for (const [id, entry] of map) {
    if (entry.expiresAt <= now) map.delete(id);
  }
  if (map.size <= MAX_ENTRIES) return;
  const ordered = [...map.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  const overflow = map.size - MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    map.delete(ordered[i][0]);
  }
}

export function putAttendancePreviewCache(
  entry: Omit<AttendancePreviewCacheEntry, "createdAt" | "expiresAt"> & {
    createdAt?: number;
    expiresAt?: number;
  }
): AttendancePreviewCacheEntry {
  purgeExpired();
  const createdAt = entry.createdAt ?? Date.now();
  const full: AttendancePreviewCacheEntry = {
    ...entry,
    createdAt,
    expiresAt: entry.expiresAt ?? createdAt + TTL_MS,
  };
  store().set(full.previewId, full);
  return full;
}

export function getAttendancePreviewCache(
  previewId: string,
  userId: string
): AttendancePreviewCacheEntry | null {
  purgeExpired();
  const entry = store().get(previewId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  if (entry.expiresAt <= Date.now()) {
    store().delete(previewId);
    return null;
  }
  return entry;
}

export function deleteAttendancePreviewCache(previewId: string, userId: string): boolean {
  const entry = store().get(previewId);
  if (!entry || entry.userId !== userId) return false;
  store().delete(previewId);
  return true;
}

/** Test helper — clears the process cache. */
export function clearAttendancePreviewCacheForTests(): void {
  store().clear();
}
