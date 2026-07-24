/**
 * Shared query-string construction for admin ticket list filters.
 * Keeps React/router concerns in the page components.
 */

export type TicketListFilterState = {
  status: string;
  category: string;
  priority: string;
  /** Local search input; serialized as `q` in the URL. */
  search: string;
};

export type TicketListSelectFilterKey = "status" | "category" | "priority";

const ALL = "all";

function appendSelectFilters(
  params: URLSearchParams,
  filters: TicketListFilterState,
  skip?: TicketListSelectFilterKey
): void {
  if (filters.status !== ALL && skip !== "status") {
    params.set("status", filters.status);
  }
  if (filters.category !== ALL && skip !== "category") {
    params.set("category", filters.category);
  }
  if (filters.priority !== ALL && skip !== "priority") {
    params.set("priority", filters.priority);
  }
}

function appendSearch(params: URLSearchParams, search: string): void {
  if (search) {
    params.set("q", search);
  }
}

/** Build params from the current filter state (and optional page). */
export function ticketListSearchParamsFromFilters(
  filters: TicketListFilterState,
  options?: { page?: number }
): URLSearchParams {
  const params = new URLSearchParams();
  appendSelectFilters(params, filters);
  appendSearch(params, filters.search);
  if (options?.page != null) {
    params.set("page", String(options.page));
  }
  return params;
}

/**
 * Build params after changing one select filter.
 * Preserves other selects and search; omits the changed key when value is `"all"`.
 */
export function ticketListSearchParamsAfterSelectChange(
  filters: TicketListFilterState,
  key: TicketListSelectFilterKey,
  value: string
): URLSearchParams {
  const params = new URLSearchParams();
  appendSelectFilters(params, filters, key);
  appendSearch(params, filters.search);
  if (value !== ALL) {
    params.set(key, value);
  }
  return params;
}

/**
 * Build params after a search submit (blur/Enter).
 * Uses `search` for `q`; preserves select filters from `filters`.
 */
export function ticketListSearchParamsAfterSearch(
  filters: TicketListFilterState,
  search: string
): URLSearchParams {
  const params = new URLSearchParams();
  appendSelectFilters(params, filters);
  appendSearch(params, search);
  return params;
}

/** Join base path with query string; omit `?` when params are empty. */
export function ticketListHref(basePath: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
