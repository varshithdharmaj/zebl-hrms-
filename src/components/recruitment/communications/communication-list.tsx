"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CommunicationListItem } from "./communication-list-item";
import { CommunicationEmptyState } from "./communication-empty-state";
import type { CommunicationListItemView, CommunicationTab } from "./types";

export const CommunicationList = memo(function CommunicationList({
  tab,
  items,
  selectedId,
  onSelect,
  page,
  totalPages,
  total,
}: {
  tab: CommunicationTab;
  items: CommunicationListItemView[];
  selectedId: string | null;
  onSelect: (item: CommunicationListItemView) => void;
  page: number;
  totalPages: number;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  if (items.length === 0) {
    return <CommunicationEmptyState tab={tab} />;
  }

  return (
    <div className="flex h-full min-h-[24rem] flex-col">
      <div
        className="flex-1 space-y-2 overflow-y-auto pr-1"
        role="listbox"
        aria-label={`${tab} communications`}
        tabIndex={0}
      >
        {items.map((item) => (
          <div key={item.id} role="option" aria-selected={selectedId === item.id}>
            <CommunicationListItem
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          {total} result{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            disabled={page <= 1}
            className="h-8"
          >
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              Previous
            </Link>
          </Button>
          <span aria-live="polite">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <Button
            asChild
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            className="h-8"
          >
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
});
