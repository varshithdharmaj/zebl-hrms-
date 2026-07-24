"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/tickets/labels";
import type {
  TicketListFilterState,
  TicketListSelectFilterKey,
} from "@/lib/tickets/filter-params";

export type TicketListStatusOption = {
  value: string;
  label: string;
};

const DEFAULT_PRIORITY_OPTIONS: TicketListStatusOption[] = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

type TicketListFiltersProps = {
  filters: TicketListFilterState;
  searchPlaceholder?: string;
  statusOptions: TicketListStatusOption[];
  priorityOptions?: TicketListStatusOption[];
  onSearchInputChange: (value: string) => void;
  onSearchCommit: (value: string) => void;
  onSelectChange: (key: TicketListSelectFilterKey, value: string) => void;
};

/**
 * Presentation-only ticket list filter bar.
 * Route pages own filter state, URL updates, and authorization/query scope.
 */
export function TicketListFilters({
  filters,
  searchPlaceholder = "Search tickets...",
  statusOptions,
  priorityOptions = DEFAULT_PRIORITY_OPTIONS,
  onSearchInputChange,
  onSearchCommit,
  onSelectChange,
}: TicketListFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={filters.search}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onBlur={(e) => onSearchCommit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchCommit(filters.search)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2">
        <div className="w-40">
          <Select
            value={filters.status}
            onValueChange={(v) => onSelectChange("status", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select
            value={filters.category}
            onValueChange={(v) => onSelectChange("category", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select
            value={filters.priority}
            onValueChange={(v) => onSelectChange("priority", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
