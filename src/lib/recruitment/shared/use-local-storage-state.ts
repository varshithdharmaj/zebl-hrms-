"use client";

import { useEffect, useState } from "react";

/**
 * Level-1 (client-only) preference persistence — no database table. Reads
 * are deferred to a post-mount effect so SSR/first-paint always matches
 * `defaultValue` (no hydration mismatch); the stored value then hydrates in.
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // Malformed value or storage unavailable (private browsing) — keep default.
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable/full — preference just won't persist this session.
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
