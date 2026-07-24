"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ticketListHref,
  ticketListSearchParamsAfterSearch,
  ticketListSearchParamsAfterSelectChange,
  type TicketListFilterState,
  type TicketListSelectFilterKey,
} from "@/lib/tickets/filter-params";

/**
 * Shared client filter/URL state for admin ticket list surfaces.
 * Does not encode authorization — pages supply the correct basePath and server data.
 */
export function useTicketListFilters(
  basePath: string,
  initialFilters: {
    status: string;
    category: string;
    priority: string;
    search: string;
  }
) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || "all");
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || "all");
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.priority || "all");

  const filters: TicketListFilterState = {
    status: statusFilter,
    category: categoryFilter,
    priority: priorityFilter,
    search,
  };

  const onSearchInputChange = (value: string) => setSearch(value);

  const onSearchCommit = (value: string) => {
    setSearch(value);
    router.push(
      ticketListHref(basePath, ticketListSearchParamsAfterSearch(filters, value))
    );
  };

  const onSelectChange = (key: TicketListSelectFilterKey, value: string) => {
    if (key === "status") setStatusFilter(value);
    if (key === "category") setCategoryFilter(value);
    if (key === "priority") setPriorityFilter(value);
    router.push(
      ticketListHref(basePath, ticketListSearchParamsAfterSelectChange(filters, key, value))
    );
  };

  return {
    filters,
    onSearchInputChange,
    onSearchCommit,
    onSelectChange,
  };
}
