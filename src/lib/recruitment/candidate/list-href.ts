/** Shared filter state + href builder (safe for Server and Client Components). */

export type CandidateListFilterState = {
  q?: string;
  status?: string;
  source?: string;
  includeArchived?: boolean;
  sort?: string;
  direction?: string;
  page?: number;
};

export function candidateListHref(
  filters: CandidateListFilterState,
  page?: number
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.includeArchived) params.set("includeArchived", "true");
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.direction) params.set("direction", filters.direction);
  const p = page ?? filters.page ?? 1;
  if (p > 1) params.set("page", String(p));
  const qs = params.toString();
  return qs
    ? `/admin/recruitment/candidates?${qs}`
    : "/admin/recruitment/candidates";
}
