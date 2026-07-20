"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResultItem } from "@/lib/search/global-search";

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: SearchResultItem[] };
      setResults(data.results ?? []);
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:flex"
        aria-label="Open search"
      >
        <Search className="h-4 w-4" />
        <span>Search</span>
        <kbd className="rounded border border-border bg-background px-1.5 text-[10px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]">
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-label="Global search"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && results[activeIndex]) {
                navigate(results[activeIndex].href);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search employees, leave, audit…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-2" role="listbox">
          {loading && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">No results.</li>
          )}
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors",
                  i === activeIndex ? "bg-primary-muted" : "hover:bg-muted/50"
                )}
                onClick={() => navigate(r.href)}
              >
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10"
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />
    </div>
  );
}
