"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComposeRecipientOption, RecipientKind } from "./compose-types";

const KIND_LABELS: Record<RecipientKind, string> = {
  candidate: "Candidate",
  application: "Application",
  job: "Job opening",
  interview: "Interview",
  offer: "Offer",
  manual: "Manual email",
};

export function RecipientSelector({
  options,
  selectedIds,
  manualEmail,
  onToggleOption,
  onManualEmailChange,
}: {
  options: ComposeRecipientOption[];
  selectedIds: string[];
  manualEmail: string;
  onToggleOption: (option: ComposeRecipientOption) => void;
  onManualEmailChange: (email: string) => void;
}) {
  const [kindFilter, setKindFilter] = useState<RecipientKind | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((option) => {
      if (kindFilter !== "all" && option.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        option.label.toLowerCase().includes(q) ||
        (option.email?.toLowerCase().includes(q) ?? false) ||
        (option.secondaryLabel?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [kindFilter, options, query]);

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle"
      aria-label="Recipients"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Recipients</h2>
        <p className="text-xs text-slate-500">
          Primary recipient receives the email. Additional linked records enrich placeholders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recipient-search">Search</Label>
          <Input
            id="recipient-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, job…"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipient-kind">Source</Label>
          <Select
            value={kindFilter}
            onValueChange={(value) => setKindFilter(value as RecipientKind | "all")}
          >
            <SelectTrigger id="recipient-kind" className="h-9" aria-label="Filter recipient source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="candidate">Candidates</SelectItem>
              <SelectItem value="application">Applications</SelectItem>
              <SelectItem value="job">Job openings</SelectItem>
              <SelectItem value="interview">Interviews</SelectItem>
              <SelectItem value="offer">Offers</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2"
        role="listbox"
        aria-label="Recipient options"
        aria-multiselectable="true"
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500">No matching recipients.</p>
        ) : (
          filtered.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onToggleOption(option)}
                className={
                  selected
                    ? "flex w-full flex-col rounded-md bg-slate-900 px-3 py-2 text-left text-white"
                    : "flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-slate-50"
                }
              >
                <span className="text-xs font-semibold">{option.label}</span>
                <span className={selected ? "text-[11px] text-slate-200" : "text-[11px] text-slate-500"}>
                  {KIND_LABELS[option.kind]}
                  {option.email ? ` · ${option.email}` : " · No email"}
                  {option.secondaryLabel ? ` · ${option.secondaryLabel}` : ""}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="manual-email">Primary recipient email</Label>
        <Input
          id="manual-email"
          type="email"
          value={manualEmail}
          onChange={(event) => onManualEmailChange(event.target.value)}
          placeholder="candidate@example.com"
          className="h-9"
          required
        />
      </div>
    </section>
  );
}
