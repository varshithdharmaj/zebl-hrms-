"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RecruitmentCommunicationType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommunicationSearch } from "./communication-search";
import type { CommunicationFilterState, CommunicationTab } from "./types";

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All types" },
  { value: RecruitmentCommunicationType.email_sent, label: "Email sent" },
  { value: RecruitmentCommunicationType.email_received, label: "Email received" },
  { value: RecruitmentCommunicationType.interview_invitation, label: "Interview invitation" },
  { value: RecruitmentCommunicationType.interview_reminder, label: "Interview reminder" },
  { value: RecruitmentCommunicationType.offer_letter, label: "Offer letter" },
  { value: RecruitmentCommunicationType.rejection, label: "Rejection" },
  { value: RecruitmentCommunicationType.internal_note, label: "Internal note" },
  { value: RecruitmentCommunicationType.system_notification, label: "System notification" },
];

export function CommunicationFilters({
  filters,
}: {
  filters: CommunicationFilterState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function buildHref(overrides: Partial<CommunicationFilterState>): string {
    const params = new URLSearchParams(searchParams.toString());
    const nextTab = overrides.tab ?? filters.tab;
    const nextQ = overrides.q ?? filters.q;
    const nextType = overrides.type ?? filters.type;
    const nextPage = overrides.page ?? 1;

    params.set("tab", nextTab);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextType && nextType !== "all") params.set("type", nextType);
    else params.delete("type");

    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    // Changing filters clears thread selection
    if (overrides.tab || overrides.q !== undefined || overrides.type) {
      params.delete("threadId");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:grid-cols-[1fr_12rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const q = String(formData.get("q") ?? "");
        const type = String(formData.get("type") ?? "all");
        startTransition(() => {
          router.push(buildHref({ q, type, page: 1 }));
        });
      }}
      aria-label="Communication filters"
    >
      <input type="hidden" name="tab" value={filters.tab} />
      <CommunicationSearch defaultValue={filters.q} />

      <div className="space-y-1.5">
        <span className="sr-only">Type filter</span>
        <Select
          value={filters.type || "all"}
          onValueChange={(value) => {
            startTransition(() => {
              router.push(buildHref({ type: value, page: 1 }));
            });
          }}
        >
          <SelectTrigger className="h-10 bg-background" aria-label="Filter by communication type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="type" value={filters.type || "all"} />
      </div>

      <Button type="submit" variant="outline" className="h-10" disabled={isPending}>
        {isPending ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}

export function communicationTabHref(
  tab: CommunicationTab,
  current: URLSearchParams
): string {
  const params = new URLSearchParams(current.toString());
  params.set("tab", tab);
  params.delete("page");
  params.delete("threadId");
  const query = params.toString();
  return query ? `?${query}` : "?tab=inbox";
}
