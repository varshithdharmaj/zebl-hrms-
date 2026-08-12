"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationCenterItem } from "@/lib/notifications/notification-center";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationCenterResponse {
  items: NotificationCenterItem[];
}

/** In-flight dedupe across dual mobile/desktop mounts. */
let activeCenterFetch: Promise<NotificationCenterResponse> | null = null;

/** Short-lived completed snapshot — avoids an immediate duplicate after SSR/hydration. */
let centerCache: { at: number; data: NotificationCenterResponse } | null = null;

const CENTER_CACHE_TTL_MS = 30_000;

function readCenterCache(): NotificationCenterResponse | null {
  if (!centerCache) return null;
  if (Date.now() - centerCache.at > CENTER_CACHE_TTL_MS) {
    centerCache = null;
    return null;
  }
  return centerCache.data;
}

function writeCenterCache(data: NotificationCenterResponse) {
  centerCache = { at: Date.now(), data };
}

function mapItems(items: NotificationCenterItem[] | undefined): NotificationCenterItem[] {
  return (items ?? []).map((i) => ({
    ...i,
    createdAt: new Date(i.createdAt),
  }));
}

/** Shared loader: in-flight dedupe + 30s TTL cache (module scope, per browser tab). */
export async function loadNotificationCenter(): Promise<NotificationCenterResponse> {
  const cached = readCenterCache();
  if (cached) return cached;

  if (!activeCenterFetch) {
    activeCenterFetch = fetch("/api/notifications/center")
      .then((r) => {
        if (!r.ok) throw new Error("API failed");
        return r.json() as Promise<NotificationCenterResponse>;
      })
      .then((data) => {
        writeCenterCache(data);
        return data;
      })
      .finally(() => {
        activeCenterFetch = null;
      });
  }

  return activeCenterFetch;
}

/** Test seam — reset module cache between unit tests. */
export function __resetNotificationCenterCacheForTests() {
  activeCenterFetch = null;
  centerCache = null;
}

type LoadState = "loading" | "ready" | "error";

export function NotificationCenterButton() {
  const cached = readCenterCache();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationCenterItem[]>(() =>
    mapItems(cached?.items)
  );
  const [loadState, setLoadState] = useState<LoadState>(() =>
    cached ? "ready" : "loading"
  );

  // Initial load once per mount tree; dual mobile/desktop instances share in-flight + TTL cache.
  useEffect(() => {
    let cancelled = false;
    if (!readCenterCache()) setLoadState("loading");
    void loadNotificationCenter()
      .then((d) => {
        if (cancelled) return;
        setItems(mapItems(d.items));
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh when opening if the TTL snapshot expired (preserves freshness model).
  useEffect(() => {
    if (!open) return;
    if (readCenterCache()) return;
    let cancelled = false;
    setLoadState((prev) => (prev === "ready" && items.length > 0 ? prev : "loading"));
    void loadNotificationCenter()
      .then((d) => {
        if (cancelled) return;
        setItems(mapItems(d.items));
        setLoadState("ready");
      })
      .catch(() => {
        /* keep prior items on refresh failure */
        if (!cancelled && items.length === 0) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, items.length]);

  const count = items.filter((i) => i.severity !== "info").length;
  const showLoading = loadState === "loading";
  const showEmpty = loadState === "ready" && items.length === 0;
  const showError = loadState === "error" && items.length === 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border border-border p-2 hover:bg-muted"
        aria-label="Notifications"
        aria-expanded={open}
        aria-busy={showLoading || undefined}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
            </div>
            <ul className="max-h-64 overflow-y-auto" aria-busy={showLoading || undefined}>
              {showLoading ? (
                <li className="space-y-3 px-4 py-4" role="status" aria-label="Loading notifications">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  ))}
                </li>
              ) : showError ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">
                  Could not load notifications.
                </li>
              ) : showEmpty ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">All clear.</li>
              ) : (
                items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block px-4 py-3 text-sm transition-colors hover:bg-muted/50",
                        item.severity === "danger" && "border-l-2 border-danger",
                        item.severity === "warning" && "border-l-2 border-warning"
                      )}
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
