"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppTabs } from "@/components/ui/app-tabs";
import { deleteDraftAction } from "@/actions/recruitment-communications";
import { CommunicationFilters } from "./communication-filters";
import { CommunicationList } from "./communication-list";
import { CommunicationThread } from "./communication-thread";
import { CommunicationDeleteDialog } from "./communication-delete-dialog";
import type {
  CommunicationCenterCounts,
  CommunicationFilterState,
  CommunicationListItemView,
  CommunicationTab,
  CommunicationThreadMessageView,
} from "./types";

const TABS: CommunicationTab[] = ["inbox", "sent", "drafts", "scheduled"];

function tabLabel(tab: CommunicationTab): string {
  if (tab === "inbox") return "Inbox";
  if (tab === "sent") return "Sent";
  if (tab === "scheduled") return "Scheduled";
  return "Drafts";
}

export function CommunicationCenter({
  filters,
  counts,
  items,
  total,
  totalPages,
  threadMessages,
  currentUserId,
}: {
  filters: CommunicationFilterState;
  counts: CommunicationCenterCounts;
  items: CommunicationListItemView[];
  total: number;
  totalPages: number;
  threadMessages: CommunicationThreadMessageView[];
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<CommunicationListItemView | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");

  const selectedId = useMemo(() => {
    if (filters.threadId) {
      const match = items.find(
        (item) => item.threadId === filters.threadId || item.id === filters.threadId
      );
      return match?.id ?? threadMessages[threadMessages.length - 1]?.id ?? null;
    }
    return null;
  }, [filters.threadId, items, threadMessages]);

  const navigateWithParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams]
  );

  const handleTabChange = useCallback(
    (id: string) => {
      navigateWithParams((params) => {
        params.set("tab", id);
        params.delete("page");
        params.delete("threadId");
      });
    },
    [navigateWithParams]
  );

  const handleSelect = useCallback(
    (item: CommunicationListItemView) => {
      navigateWithParams((params) => {
        params.set("threadId", item.threadId ?? item.id);
      });
    },
    [navigateWithParams]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteDraftAction({}, { id: deleteTarget.id });
      if (result.error) {
        setStatusTone("error");
        setStatusMessage(result.error);
        return;
      }
      setStatusTone("success");
      setStatusMessage(result.success ?? "Draft deleted successfully.");
      setDeleteTarget(null);
      navigateWithParams((params) => {
        params.delete("threadId");
      });
      router.refresh();
    });
  }, [deleteTarget, navigateWithParams, router]);

  const tabs = TABS.map((tab) => ({
    id: tab,
    label: tabLabel(tab),
    count: counts[tab],
  }));

  return (
    <div className="space-y-5">
      <AppTabs tabs={tabs} active={filters.tab} onChange={handleTabChange} />

      {statusMessage && (
        <div
          role="status"
          className={
            statusTone === "error"
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          }
        >
          {statusMessage}
        </div>
      )}

      <CommunicationFilters filters={filters} />

      <div
        className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
        aria-busy={isPending}
      >
        <section
          className="rounded-xl border border-border bg-card p-3 shadow-subtle"
          aria-label={`${tabLabel(filters.tab)} list`}
        >
          <CommunicationList
            tab={filters.tab}
            items={items}
            selectedId={selectedId}
            onSelect={handleSelect}
            page={filters.page}
            totalPages={totalPages}
            total={total}
          />
        </section>

        <section aria-label="Conversation thread">
          <CommunicationThread
            messages={threadMessages}
            onDeleteDraft={
              filters.tab === "drafts"
                ? (messageId) => {
                    const message =
                      threadMessages.find((row) => row.id === messageId) ??
                      items.find((row) => row.id === messageId) ??
                      null;
                    if (message) setDeleteTarget(message);
                  }
                : undefined
            }
          />
        </section>
      </div>

      <p className="sr-only" aria-live="polite">
        Signed in as user {currentUserId}.{" "}
        {isPending ? "Updating communications." : "Communications ready."}
      </p>

      <CommunicationDeleteDialog
        open={Boolean(deleteTarget)}
        pending={isPending}
        subject={deleteTarget?.subject ?? null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
