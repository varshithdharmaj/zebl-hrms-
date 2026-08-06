/** Shared filter state + href builder for offers list. */

export type OfferListFilterState = {
  q?: string;
  status?: string;
  jobOpeningId?: string;
  recruiterUserId?: string;
  sort?: string;
  direction?: string;
  page?: number;
};

export function offerListHref(filters: OfferListFilterState, page?: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.jobOpeningId && filters.jobOpeningId !== "all") {
    params.set("jobOpeningId", filters.jobOpeningId);
  }
  if (filters.recruiterUserId && filters.recruiterUserId !== "all") {
    params.set("recruiterUserId", filters.recruiterUserId);
  }
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.direction) params.set("direction", filters.direction);
  const p = page ?? filters.page ?? 1;
  if (p > 1) params.set("page", String(p));
  const qs = params.toString();
  return qs ? `/admin/recruitment/offers?${qs}` : "/admin/recruitment/offers";
}
