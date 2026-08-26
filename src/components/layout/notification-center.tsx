"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationCenterItem } from "@/lib/notifications/notification-center";

export function NotificationCenterButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationCenterItem[]>([]);

  useEffect(() => {
    fetch("/api/notifications/center")
      .then((r) => r.json())
      .then((d: { items: NotificationCenterItem[] }) => {
        setItems(
          (d.items ?? []).map((i) => ({
            ...i,
            createdAt: new Date(i.createdAt),
          }))
        );
      })
      .catch(() => setItems([]));
  }, [open]);

  const count = items.filter((i) => i.severity !== "info").length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border border-border p-2 hover:bg-muted"
        aria-label="Notifications"
        aria-expanded={open}
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
            <ul className="max-h-64 overflow-y-auto">
              {items.length === 0 ? (
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
