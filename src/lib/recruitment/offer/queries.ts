import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";
import type { OfferListFilters } from "@/lib/recruitment/repositories/offer-repository";
import type { SearchFilters, SortOptions } from "@/lib/recruitment/types/pagination";

export const getOfferCached = cache(async (session: SessionUser, offerId: string) => {
  const service = createOfferService();
  return service.getOffer(session, offerId);
});

export const listOffersCached = cache(
  async (
    session: SessionUser,
    filters: OfferListFilters | SearchFilters | undefined,
    pagination: { page: number; pageSize: number },
    sort?: SortOptions
  ) => {
    const service = createOfferService();
    return service.listOffers(session, {
      filters,
      pagination: normalizePagination(pagination),
      sort,
    });
  }
);

export const getOfferDashboardMetricsCached = cache(
  async (session: SessionUser, filters?: OfferListFilters | SearchFilters) => {
    const service = createOfferService();
    return service.getDashboardMetrics(session, filters);
  }
);
